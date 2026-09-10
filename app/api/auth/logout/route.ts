import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { clearSessionCookie, getSessionAdmin } from "@/lib/session";
import { handleRouteError } from "@/lib/validate";

export async function POST() {
  try {
    // Invalidate BEFORE clearing the cookie: dropping the cookie alone
    // leaves a copied JWT valid for its full 30 days.
    //
    // Two shapes (migration 52):
    //   * the team viewer ends THIS seat only — its viewer_sessions row
    //     goes, and lib/session.ts refuses the token once the row is
    //     missing. No epoch bump: that would sign out the other phones
    //     sharing the credential.
    //   * every other account bumps the epoch. There are no session
    //     rows for them, so this is logout-everywhere by design; per-
    //     device invalidation for admins stays a Feature 7 item.
    const admin = await getSessionAdmin();
    if (admin?.seatId) {
      await pool.query(
        `DELETE FROM viewer_sessions WHERE id = $1 AND admin_id = $2`,
        [admin.seatId, admin.id],
      );
    } else if (admin) {
      await pool.query(
        `UPDATE admins SET session_epoch = session_epoch + 1 WHERE id = $1`,
        [admin.id],
      );
    }
    await clearSessionCookie();
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleRouteError("[auth/logout]", error);
  }
}
