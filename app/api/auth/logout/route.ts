import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { clearSessionCookie, getSessionAdmin } from "@/lib/session";
import { handleRouteError } from "@/lib/validate";

export async function POST() {
  try {
    // Bump the epoch BEFORE clearing the cookie: that is what actually
    // invalidates the token. Dropping the cookie alone leaves a copied
    // JWT valid for its full 30 days.
    //
    // There is no sessions table, so this is logout-everywhere by
    // design — every device holding a token for this account is signed
    // out. Per-device invalidation would need session rows (Feature 7).
    //
    // For the team viewer this is also what frees its single seat
    // (migration 50): the next player can sign in the moment this one
    // logs out. NULL is a no-op on every other account.
    const admin = await getSessionAdmin();
    if (admin) {
      await pool.query(
        `UPDATE admins
            SET session_epoch = session_epoch + 1,
                viewer_session_started_at = NULL
          WHERE id = $1`,
        [admin.id],
      );
    }
    await clearSessionCookie();
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleRouteError("[auth/logout]", error);
  }
}
