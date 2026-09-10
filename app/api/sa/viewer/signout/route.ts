import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireTeamSuperadmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

// "Sign out all": drop every viewer_sessions row (migration 52) so each
// phone on the shared login is refused on its next request, and bump
// the account's session_epoch as belt and braces. The password is
// unchanged — the same credential works, it just has to be typed once
// more, and the seats are all free. Per-seat sign-out lives in
// sessions/[id].
export async function POST() {
  try {
    const superadmin = await requireTeamSuperadmin();
    const res = await pool.query<{ username: string; signed_out: number }>(
      `WITH v AS (
         SELECT admin_id FROM team_memberships
          WHERE team_id = $1 AND team_role = 'viewer' AND is_active
       ), gone AS (
         DELETE FROM viewer_sessions
          WHERE admin_id IN (SELECT admin_id FROM v)
         RETURNING id
       )
       UPDATE admins SET session_epoch = session_epoch + 1
        WHERE id IN (SELECT admin_id FROM v)
       RETURNING username, (SELECT count(*)::int FROM gone) AS signed_out`,
      [superadmin.scopeId],
    );
    if (res.rowCount === 0) {
      throw new ApiError(404, "NO_VIEWER", "This team has no viewer login");
    }
    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error) {
    return handleRouteError("[sa/viewer/signout]", error);
  }
}
