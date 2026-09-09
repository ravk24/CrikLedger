import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireTeamSuperadmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

// "Sign out the viewer": bump the viewer account's session_epoch so the
// phone holding that token is refused on its next request, and free the
// single seat (migration 50) so the next player can sign in. The
// password is unchanged — the same credential works, it just has to be
// typed once more.
export async function POST() {
  try {
    const superadmin = await requireTeamSuperadmin();
    const res = await pool.query<{ username: string }>(
      `UPDATE admins
          SET session_epoch = session_epoch + 1,
              viewer_session_started_at = NULL
        WHERE id = (SELECT admin_id FROM team_memberships
                     WHERE team_id = $1 AND team_role = 'viewer' AND is_active)
      RETURNING username`,
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
