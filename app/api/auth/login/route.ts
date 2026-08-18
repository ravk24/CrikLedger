import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { signSession, setSessionCookie, setTeamCookie } from "@/lib/session";
import { ApiError, handleRouteError, loginSchema } from "@/lib/validate";

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
