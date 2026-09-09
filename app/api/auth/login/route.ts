import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { signSession, setSessionCookie, setTeamCookie } from "@/lib/session";
import { ApiError, handleRouteError, loginSchema } from "@/lib/validate";

// The team viewer (migrations 49–50) is a shared credential with ONE
// seat. Claim it atomically — the UPDATE only lands when nobody holds it
// — or tell the player who does, and who can free it. Checked AFTER the
// password, so a wrong password never learns whether the seat is taken.
async function claimViewerSeat(adminId: string): Promise<void> {
  const viewerOf = await pool.query<{ team_id: string }>(
    `SELECT team_id FROM team_memberships
      WHERE admin_id = $1 AND team_role = 'viewer' AND is_active`,
    [adminId],
  );
  const teamId = viewerOf.rows[0]?.team_id;
  if (!teamId) return; // not a viewer account

  const claimed = await pool.query(
    `UPDATE admins SET viewer_session_started_at = NOW()
      WHERE id = $1 AND viewer_session_started_at IS NULL`,
    [adminId],
  );
  if ((claimed.rowCount ?? 0) > 0) return;

  const info = await pool.query<{ since: string | null; superadmin: string | null }>(
    `SELECT a.viewer_session_started_at::text AS since,
            (SELECT sa.name
               FROM team_memberships m
               JOIN admins sa ON sa.id = m.admin_id
              WHERE m.team_id = $2 AND m.team_role = 'superadmin' AND m.is_active
              ORDER BY m.created_at
              LIMIT 1) AS superadmin
       FROM admins a
      WHERE a.id = $1`,
    [adminId, teamId],
  );
  const since = info.rows[0]?.since;
  const superadmin = info.rows[0]?.superadmin ?? "your superadmin";
  throw new ApiError(
    409,
    "VIEWER_BUSY",
    `The viewer login is already in use${since ? ` since ${formatDateTime(since)}` : ""}. ` +
      `Ask ${superadmin} (superadmin) to sign that session out, or ask whoever is signed in on your WhatsApp group to log out.`,
  );
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = loginSchema.parse(await req.json());

    // Password verification happens in SQL via pgcrypto. One generic
    // error for wrong username vs wrong password — never reveal which.
    const res = await pool.query(
      `SELECT id, name, platform_role, session_epoch, must_change_password, is_active
       FROM admins
       WHERE username = $1 AND password_hash = crypt($2, password_hash)`,
      [username, password],
    );
    const row = res.rows[0];
    if (!row) {
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid username or password",
      );
    }
    if (!row.is_active) {
      throw new ApiError(403, "ADMIN_REVOKED", "This account has been revoked");
    }
    await claimViewerSeat(row.id);

    // Roles are NOT in the token — they live in membership rows that can
    // be revoked mid-session. The epoch is, so logout and password change
    // can invalidate this token.
    const token = await signSession({
      adminId: row.id,
      epoch: row.session_epoch,
    });
    await setSessionCookie(token);

    // Teams this account can act on, most recently granted last. The
    // first is the default active team; a switcher appears when >1.
    const teams = await pool.query<{ slug: string; display_name: string }>(
      `SELECT t.slug, t.display_name
         FROM team_memberships m
         JOIN teams t ON t.id = m.team_id
        WHERE m.admin_id = $1 AND m.is_active
        ORDER BY t.display_name`,
      [row.id],
    );
    if (teams.rows[0]) await setTeamCookie(teams.rows[0].slug);

    return NextResponse.json({
      success: true,
      data: {
        admin_id: row.id,
        name: row.name,
        platform_role: row.platform_role,
        teams: teams.rows,
        active_team: teams.rows[0]?.slug ?? null,
        force_change: row.must_change_password,
      },
    });
  } catch (error) {
    return handleRouteError("[auth/login]", error);
  }
}
