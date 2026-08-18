import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireMegaadmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

// Platform-level suspend. This is the ONLY surface that writes
// admins.is_active — a team superadmin revoking someone flips the
// membership instead, so it cannot disable an account that is
// superadmin of its own team elsewhere.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const self = await requireMegaadmin();
    const { id } = await params;

    // Suspending yourself would lock the platform out of its own console.
    if (id === self.id) {
      throw new ApiError(409, "CANNOT_SUSPEND_SELF", "You cannot suspend yourself");
    }

    const res = await pool.query(
      `UPDATE admins
          SET is_active = FALSE, session_epoch = session_epoch + 1
        WHERE id = $1
      RETURNING id, username, is_active`,
      [id],
    );
    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Account not found");
    }
    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error) {
    return handleRouteError("[ops/suspend]", error);
  }
}
