import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/cookies";
import { pool, withTransaction } from "@/lib/db";
import {
  signSession,
  setSessionCookie,
  setTeamCookie,
  verifySessionToken,
} from "@/lib/session";
import { ApiError, handleRouteError, loginSchema } from "@/lib/validate";
import {
  VIEWER_SEAT_LIMIT,
  deviceLabel,
  viewerBusyMessage,
} from "@/lib/viewerSeats";

// The team viewer (migrations 49, 52) is a shared credential with a
// fixed number of seats, one viewer_sessions row each. Claim one inside
// a transaction that locks the account row, so two players who both see
// nine seats cannot both take the tenth — or tell the refused player who
// can free one. Checked AFTER the password, so a wrong password never
// learns whether the seats are full. Returns the seat id for the token,
// or null for every non-viewer account.
async function claimViewerSeat(
  adminId: string,
  userAgent: string | null,
  ownSeat: string | undefined,
): Promise<string | null> {
  const viewerOf = await pool.query<{ team_id: string }>(
    `SELECT team_id FROM team_memberships
      WHERE admin_id = $1 AND team_role = 'viewer' AND is_active`,
    [adminId],
  );
  const teamId = viewerOf.rows[0]?.team_id;
  if (!teamId) return null; // not a viewer account

  return withTransaction(async (client) => {
    await client.query(`SELECT id FROM admins WHERE id = $1 FOR UPDATE`, [
      adminId,
    ]);
    // The same browser signing in again while it still holds a seat
    // replaces that seat rather than taking a second one.
    if (ownSeat) {
      await client.query(
        `DELETE FROM viewer_sessions WHERE id = $1 AND admin_id = $2`,
        [ownSeat, adminId],
      );
    }
    // A seat older than the session lifetime belongs to a token that no
    // longer verifies. Two statements, not a CTE: a DELETE inside WITH is
    // invisible to a count in the same statement.
    await client.query(
      `DELETE FROM viewer_sessions
        WHERE admin_id = $1
          AND started_at < NOW() - make_interval(secs => $2)`,
      [adminId, SESSION_MAX_AGE_SECONDS],
    );
    const live = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM viewer_sessions WHERE admin_id = $1`,
      [adminId],
    );
    if (live.rows[0].n >= VIEWER_SEAT_LIMIT) {
      const sa = await client.query<{ name: string }>(
        `SELECT sa.name
           FROM team_memberships m
           JOIN admins sa ON sa.id = m.admin_id
          WHERE m.team_id = $1 AND m.team_role = 'superadmin' AND m.is_active
          ORDER BY m.created_at
          LIMIT 1`,
        [teamId],
      );
      throw new ApiError(
        409,
        "VIEWER_BUSY",
        viewerBusyMessage(VIEWER_SEAT_LIMIT, sa.rows[0]?.name ?? null),
      );
    }
    const seat = await client.query<{ id: string }>(
      `INSERT INTO viewer_sessions (admin_id, device)
       VALUES ($1, $2)
       RETURNING id`,
      [adminId, deviceLabel(userAgent)],
    );
    return seat.rows[0].id;
  });
}

// The seat this browser already holds for THIS account, if its cookie
// still verifies. Anything else (no cookie, another account, a stale
// token) is ignored — the login page is reachable while signed in.
async function currentSeatOf(adminId: string): Promise<string | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return undefined;
  const payload = await verifySessionToken(token);
  return payload?.adminId === adminId ? payload.sid : undefined;
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
    const sid = await claimViewerSeat(
      row.id,
      req.headers.get("user-agent"),
      await currentSeatOf(row.id),
    );

    // Roles are NOT in the token — they live in membership rows that can
    // be revoked mid-session. The epoch is, so logout and password change
    // can invalidate this token. The viewer's seat id rides along too.
    const token = await signSession({
      adminId: row.id,
      epoch: row.session_epoch,
      ...(sid ? { sid } : {}),
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
