import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

// Un-revoke. The temp password stays whatever it was — pair with
// reset-password if they've forgotten it.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSuperadmin();
    const { id } = await params;

    const res = await pool.query(
      `UPDATE admins SET is_active = TRUE
       WHERE id = $1 AND role = 'admin'
       RETURNING id, username, name`,
      [id],
    );
    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Admin not found");
    }
    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error) {
    return handleRouteError("[sa/admins/restore]", error);
  }
}
