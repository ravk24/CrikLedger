import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireTeamSuperadmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

// Revoke a team admin. This flips the MEMBERSHIP, never admins.is_active
// — the same person may be superadmin of their own team, and one team's
// superadmin must not be able to disable their account platform-wide.
// Only the megaadmin console suspends an account itself.
//
// Revoking frees the admin_slot, so the team can appoint someone else.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const superadmin = await requireTeamSuperadmin();
    const { id } = await params;

    if (id === superadmin.id) {
      throw new ApiError(409, "CANNOT_REVOKE_SELF", "You cannot revoke yourself");
    }

    const target = await pool.query<{ team_role: string; is_active: boolean }>(
      `SELECT team_role, is_active FROM team_memberships
        WHERE team_id = $1 AND admin_id = $2`,
      [superadmin.scopeId, id],
    );
    const row = target.rows[0];
    if (!row) {
      throw new ApiError(404, "NOT_FOUND", "Not a member of this team");
    }
    if (row.team_role === "superadmin") {
      throw new ApiError(
        409,
        "CANNOT_REVOKE_SUPERADMIN",
        "A superadmin cannot be revoked",
      );
    }

    await pool.query(
      `UPDATE team_memberships
          SET is_active = FALSE, revoked_at = NOW()
        WHERE team_id = $1 AND admin_id = $2`,
      [superadmin.scopeId, id],
    );
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleRouteError("[sa/admins/revoke]", error);
  }
}
