import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { generateTempPassword } from "@/lib/password";
import { requireSuperadmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSuperadmin();
    const { id } = await params;

    const tempPassword = generateTempPassword();
    const res = await pool.query(
      `UPDATE admins
       SET password_hash = crypt($2, gen_salt('bf')),
           must_change_password = TRUE
       WHERE id = $1
       RETURNING id, username, name`,
      [id, tempPassword],
    );
    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Admin not found");
    }

    return NextResponse.json({
      success: true,
      data: { ...res.rows[0], temp_password: tempPassword },
    });
  } catch (error) {
    return handleRouteError("[sa/admins/reset-password]", error);
  }
}
