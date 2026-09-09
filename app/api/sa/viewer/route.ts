import { NextRequest, NextResponse } from "next/server";
import { pool, withTransaction } from "@/lib/db";
import { requireTeamSuperadmin } from "@/lib/session";
import { ApiError, createViewerSchema, handleRouteError } from "@/lib/validate";

// The team viewer: ONE shared read-only login per team (migration 49),
// created and owned by the team's superadmin. Any number of players sign
// in with it at once; the superadmin's sign-out and reset live in the
// sibling routes. Everything here is scoped to the caller's active team.

export type ViewerRow = {
  username: string;
  created_at: string;
  in_use_since: string | null; // the single seat (migration 50); null = free
};

const VIEWER_SQL = `
  SELECT a.username, m.created_at::text AS created_at,
         a.viewer_session_started_at::text AS in_use_since
    FROM team_memberships m
    JOIN admins a ON a.id = m.admin_id
   WHERE m.team_id = $1 AND m.team_role = 'viewer' AND m.is_active`;

export async function GET() {
  try {
    const superadmin = await requireTeamSuperadmin();
    const res = await pool.query<ViewerRow>(VIEWER_SQL, [superadmin.scopeId]);
    return NextResponse.json({ success: true, data: res.rows[0] ?? null });
  } catch (error) {
    return handleRouteError("[sa/viewer]", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const superadmin = await requireTeamSuperadmin();
    // The superadmin picks both halves of the credential: usernames are
    // globally unique, so a taken one comes back as USERNAME_TAKEN and
    // they choose another — never a derived or random id.
    const { username, password } = createViewerSchema.parse(await req.json());

    await withTransaction(async (client) => {
      // Lock the team row so two concurrent creates cannot both pass
      // the "none yet" check; the partial unique index is the backstop.
      const team = await client.query<{ slug: string; display_name: string }>(
        `SELECT slug, display_name FROM teams WHERE id = $1 FOR UPDATE`,
        [superadmin.scopeId],
      );
      const row = team.rows[0];
      if (!row) throw new ApiError(404, "NOT_FOUND", "Team not found");

      const existing = await client.query(
        `SELECT 1 FROM team_memberships
          WHERE team_id = $1 AND team_role = 'viewer' AND is_active`,
        [superadmin.scopeId],
      );
      if ((existing.rowCount ?? 0) > 0) {
        throw new ApiError(
          409,
          "VIEWER_EXISTS",
          "This team already has a viewer login — reset or remove it first",
        );
      }

      // A team-owned account: no email, no forced first-login change —
      // the superadmin chose this password and will share it as-is.
      // The hash is the only thing stored; the password is never
      // returned or logged. The unique index on admins.username is the
      // USERNAME_TAKEN backstop below.
      const created = await client.query<{ id: string }>(
        `INSERT INTO admins
           (username, name, password_hash, platform_role, must_change_password, created_by)
         VALUES ($1, $2, crypt($3, gen_salt('bf')), 'user', FALSE, $4)
         RETURNING id`,
        [username, `${row.display_name} viewer`, password, superadmin.id],
      );
      await client.query(
        `INSERT INTO team_memberships (team_id, admin_id, team_role, created_by)
         VALUES ($1, $2, 'viewer', $3)`,
        [superadmin.scopeId, created.rows[0].id, superadmin.id],
      );
    }).catch((err: { code?: string; constraint?: string }) => {
      if (err.code === "23505") {
        throw err.constraint === "team_memberships_one_viewer_key"
          ? new ApiError(
              409,
              "VIEWER_EXISTS",
              "This team already has a viewer login — reset or remove it first",
            )
          : new ApiError(
              409,
              "USERNAME_TAKEN",
              "That user id is taken — pick another",
            );
      }
      throw err;
    });

    return NextResponse.json(
      { success: true, data: { username } },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError("[sa/viewer]", error);
  }
}

// Remove: the membership is revoked and the team-owned account is
// deactivated, which ends every session on its next request and makes
// login answer ADMIN_REVOKED. A later create mints a fresh account.
export async function DELETE() {
  try {
    const superadmin = await requireTeamSuperadmin();
    await withTransaction(async (client) => {
      const revoked = await client.query<{ admin_id: string }>(
        `UPDATE team_memberships
            SET is_active = FALSE, revoked_at = NOW()
          WHERE team_id = $1 AND team_role = 'viewer' AND is_active
        RETURNING admin_id`,
        [superadmin.scopeId],
      );
      const adminId = revoked.rows[0]?.admin_id;
      if (!adminId) {
        throw new ApiError(404, "NO_VIEWER", "This team has no viewer login");
      }
      await client.query(
        `UPDATE admins
            SET is_active = FALSE,
                session_epoch = session_epoch + 1,
                viewer_session_started_at = NULL
          WHERE id = $1`,
        [adminId],
      );
    });
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleRouteError("[sa/viewer]", error);
  }
}
