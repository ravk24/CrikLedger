import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { generateTempPassword } from "@/lib/password";
import { requireTeamSuperadmin } from "@/lib/session";
import { ApiError, createAdminSchema, handleRouteError } from "@/lib/validate";

// Team-admin management, scoped to the caller's ACTIVE team. Listing
// every account on the platform (the pre-migration-32 behaviour) became
// a cross-tenant leak the moment a second team existed.
export async function GET() {
  try {
    const superadmin = await requireTeamSuperadmin();
    const res = await pool.query(
      `SELECT a.id, a.username, a.name, m.team_role AS role,
              m.is_active, m.created_at
         FROM team_memberships m
         JOIN admins a ON a.id = m.admin_id
        WHERE m.team_id = $1
        ORDER BY m.created_at ASC`,
      [superadmin.scopeId],
    );
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error) {
    return handleRouteError("[sa/admins]", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const superadmin = await requireTeamSuperadmin();
    const { username, name } = createAdminSchema.parse(await req.json());

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Lock the team row so two concurrent creates cannot both claim
      // the last slot. The partial unique index is the final backstop.
      await client.query(`SELECT 1 FROM teams WHERE id = $1 FOR UPDATE`, [
        superadmin.scopeId,
      ]);

      const used = await client.query<{ admin_slot: number }>(
        `SELECT admin_slot FROM team_memberships
          WHERE team_id = $1 AND team_role = 'admin' AND is_active`,
        [superadmin.scopeId],
      );
      const taken = new Set(used.rows.map((r) => r.admin_slot));
      const slot = [1, 2].find((n) => !taken.has(n));
      if (!slot) {
        throw new ApiError(
          409,
          "TEAM_ADMIN_LIMIT",
          "This team already has two admins — revoke one first",
        );
      }

      // An account may already exist: the same person can be an admin on
      // another team, or a superadmin of their own. In that case LINK it
      // rather than refusing — that is what makes multi-team work. Only a
      // brand-new account gets a temp password.
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM admins WHERE username = $1`,
        [username],
      );

      let adminId: string;
      let tempPassword: string | null = null;
      if (existing.rows[0]) {
        adminId = existing.rows[0].id;
        const already = await client.query(
          `SELECT is_active FROM team_memberships
            WHERE team_id = $1 AND admin_id = $2`,
          [superadmin.scopeId, adminId],
        );
        if ((already.rowCount ?? 0) > 0) {
          throw new ApiError(
            409,
            "ALREADY_A_MEMBER",
            "That user is already on this team",
          );
        }
      } else {
        // Shown ONCE in the response — never stored or logged in plaintext.
        tempPassword = generateTempPassword();
        const created = await client.query<{ id: string }>(
          `INSERT INTO admins
             (username, name, password_hash, platform_role, must_change_password, created_by)
           VALUES ($1, $2, crypt($3, gen_salt('bf')), 'user', TRUE, $4)
           RETURNING id`,
          [username, name, tempPassword, superadmin.id],
        );
        adminId = created.rows[0].id;
      }

      const res = await client.query(
        `INSERT INTO team_memberships
           (team_id, admin_id, team_role, admin_slot, created_by)
         VALUES ($1, $2, 'admin', $3, $4)
         RETURNING admin_id AS id`,
        [superadmin.scopeId, adminId, slot, superadmin.id],
      );
      await client.query("COMMIT");

      return NextResponse.json(
        {
          success: true,
          data: {
            id: res.rows[0].id,
            username,
            name,
            temp_password: tempPassword,
          },
        },
        { status: 201 },
      );
    } catch (err) {
      await client.query("ROLLBACK");
      // Lost the slot race against a concurrent create.
      if ((err as { code?: string }).code === "23505") {
        throw new ApiError(
          409,
          "TEAM_ADMIN_LIMIT",
          "This team already has two admins — revoke one first",
        );
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return handleRouteError("[sa/admins]", error);
  }
}
