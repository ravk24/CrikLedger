import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { generateTempPassword } from "@/lib/password";
import { LEDGER, TOURNAMENT } from "@/lib/products";
import { requireMegaadmin } from "@/lib/session";
import { ApiError, grantSchema, handleRouteError } from "@/lib/validate";

// The operator's grant: a verified out-of-band payment becomes an
// entitlement row (migration 37). This is a PLATFORM write, not a scope
// write — the megaadmin may create accounts, teams and purchase records,
// and must never end up holding a membership itself (lib/roles.ts).
//
// One transaction:
//   1. the account — linked if the user id exists, created with a
//      one-time password if not (same rule as /api/sa/admins);
//   2. the team the account owns — created as "<name>'s team" with a
//      superadmin membership when it has none;
//   3. the entitlement — one Ledger per team, credits unlimited.

const slugBase = (username: string) =>
  username.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") ||
  "team";

export async function POST(req: NextRequest) {
  try {
    const operator = await requireMegaadmin();
    const { product, username, name } = grantSchema.parse(await req.json());
    const price = product === "team_ledger" ? LEDGER.priceInr : TOURNAMENT.priceInr;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // --- 1. account ---
      const existing = await client.query<{
        id: string;
        name: string;
        platform_role: string;
        is_active: boolean;
      }>(
        `SELECT id, name, platform_role, is_active FROM admins
          WHERE username = $1 FOR UPDATE`,
        [username],
      );

      let adminId: string;
      let accountName = name;
      let tempPassword: string | null = null;
      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (row.platform_role === "megaadmin") {
          throw new ApiError(
            409,
            "CANNOT_GRANT_TO_OPERATOR",
            "The operator account cannot own a team — use a separate user id",
          );
        }
        if (!row.is_active) {
          throw new ApiError(
            409,
            "ACCOUNT_SUSPENDED",
            "That account is suspended — restore it before granting",
          );
        }
        adminId = row.id;
        accountName = row.name;
      } else {
        // Shown ONCE in the response — never stored or logged in plaintext.
        tempPassword = generateTempPassword();
        const created = await client.query<{ id: string }>(
          `INSERT INTO admins
             (username, name, password_hash, platform_role, must_change_password, created_by)
           VALUES ($1, $2, crypt($3, gen_salt('bf')), 'user', TRUE, $4)
           RETURNING id`,
          [username, name, tempPassword, operator.id],
        );
        adminId = created.rows[0].id;
      }

      // --- 2. team ---
      const owned = await client.query<{ id: string; display_name: string }>(
        `SELECT id, display_name FROM teams WHERE owner_admin_id = $1
          ORDER BY created_at LIMIT 1`,
        [adminId],
      );
      let teamId: string;
      let teamName: string;
      if (owned.rows[0]) {
        teamId = owned.rows[0].id;
        teamName = owned.rows[0].display_name;
      } else {
        teamName = `${accountName}'s team`;
        const base = slugBase(username);
        // slug is UNIQUE with a format CHECK; suffix on collision.
        const taken = await client.query<{ slug: string }>(
          `SELECT slug FROM teams WHERE slug = $1 OR slug LIKE $1 || '-%'`,
          [base],
        );
        const used = new Set(taken.rows.map((r) => r.slug));
        let slug = base;
        for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

        const team = await client.query<{ id: string }>(
          `INSERT INTO teams (slug, display_name, owner_admin_id)
           VALUES ($1, $2, $3) RETURNING id`,
          [slug, teamName, adminId],
        );
        teamId = team.rows[0].id;
        await client.query(
          `INSERT INTO team_memberships (team_id, admin_id, team_role, created_by)
           VALUES ($1, $2, 'superadmin', $3)`,
          [teamId, adminId, operator.id],
        );
      }

      // --- 3. entitlement ---
      try {
        await client.query(
          `INSERT INTO entitlements (product, team_id, admin_id, price_inr, granted_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [product, teamId, adminId, price, operator.id],
        );
      } catch (err) {
        if ((err as { code?: string }).code === "23505") {
          throw new ApiError(
            409,
            "ALREADY_GRANTED",
            "This user already holds a Ledger for their team",
          );
        }
        throw err;
      }

      await client.query("COMMIT");
      return NextResponse.json(
        {
          success: true,
          data: {
            id: adminId,
            username,
            name: accountName,
            team_name: teamName,
            product,
            price_inr: price,
            temp_password: tempPassword,
          },
        },
        { status: 201 },
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return handleRouteError("[ops/grants]", error);
  }
}
