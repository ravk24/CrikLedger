import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireTeamSuperadmin } from "@/lib/session";
import { ApiError, handleRouteError, viewerPasswordSchema } from "@/lib/validate";

// The superadmin sets a new shared password and, in the same UPDATE,
// bumps the epoch so every phone on the old one is signed out. Unlike
// an admin reset there is no temp password and no forced change: the
// superadmin chose this value and will share it as-is.
export async function POST(req: NextRequest) {
  try {
    const superadmin = await requireTeamSuperadmin();
    const { password } = viewerPasswordSchema.parse(await req.json());
    const res = await pool.query<{ username: string }>(
      `UPDATE admins
          SET password_hash = crypt($2, gen_salt('bf')),
              must_change_password = FALSE,
              session_epoch = session_epoch + 1,
              viewer_session_started_at = NULL
        WHERE id = (SELECT admin_id FROM team_memberships
                     WHERE team_id = $1 AND team_role = 'viewer' AND is_active)
      RETURNING username`,
      [superadmin.scopeId, password],
    );
    if (res.rowCount === 0) {
      throw new ApiError(404, "NO_VIEWER", "This team has no viewer login");
    }
    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error) {
    return handleRouteError("[sa/viewer/reset-password]", error);
  }
}
