import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const superadmin = await requireSuperadmin();
    const { id } = await params;

    if (id === superadmin.id) {
      throw new ApiError(409, "CANNOT_REVOKE_SELF", "You cannot revoke yourself");
    }
    const target = await pool.query(
      `SELECT role, is_active FROM admins WHERE id = $1`,
      [id],
    );
    const row = target.rows[0];
    if (!row) {
      throw new ApiError(404, "NOT_FOUND", "Admin not found");
    }
    if (row.role === "superadmin") {
      throw new ApiError(
        409,
        "CANNOT_REVOKE_SUPERADMIN",
        "A superadmin cannot be revoked",
      );
    }

    await pool.query(`UPDATE admins SET is_active = FALSE WHERE id = $1`, [id]);
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleRouteError("[sa/admins/revoke]", error);
  }
}
