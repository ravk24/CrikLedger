import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireTeamSuperadmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";
import { isSeatId } from "@/lib/viewerSeats";

// Per-seat sign-out (migration 52): delete one viewer_sessions row and
// that phone is refused on its next request. No epoch bump — the other
// seats stay signed in and the password is unchanged. The join to
// team_memberships scopes the delete to the caller's own team's viewer,
// so a guessed id from another team deletes nothing.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const superadmin = await requireTeamSuperadmin();
    const { id } = await params;
    if (!isSeatId(id)) {
      throw new ApiError(404, "NOT_FOUND", "That seat is already signed out");
    }
    const res = await pool.query(
      `DELETE FROM viewer_sessions vs
        USING team_memberships m
        WHERE vs.id = $2
          AND m.admin_id = vs.admin_id
          AND m.team_id = $1 AND m.team_role = 'viewer' AND m.is_active
      RETURNING vs.id`,
      [superadmin.scopeId, id],
    );
    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "That seat is already signed out");
    }
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return handleRouteError("[sa/viewer/sessions]", error);
  }
}
