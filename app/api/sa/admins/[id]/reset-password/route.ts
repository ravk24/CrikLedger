import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { generateTempPassword } from "@/lib/password";
import { requireTeamSuperadmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const superadmin = await requireTeamSuperadmin();
    const { id } = await params;

    // Only for someone who administers THIS team. Without the membership
    // check, any superadmin could reset any account's password — the
    // whole platform, including other teams' owners.
    const member = await pool.query(
      `SELECT 1 FROM team_memberships
        WHERE team_id = $1 AND admin_id = $2 AND team_role = 'admin'`,
      [superadmin.scopeId, id],
    );
    if (member.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Not an admin of this team");
    }

    const tempPassword = generateTempPassword();
    const res = await pool.query(
      `UPDATE admins
          SET password_hash = crypt($2, gen_salt('bf')),
              must_change_password = TRUE,
              session_epoch = session_epoch + 1
        WHERE id = $1
      RETURNING id, username, name`,
      [id, tempPassword],
    );
    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Account not found");
    }

    return NextResponse.json({
      success: true,
      data: { ...res.rows[0], temp_password: tempPassword },
    });
  } catch (error) {
    return handleRouteError("[sa/admins/reset-password]", error);
  }
}
