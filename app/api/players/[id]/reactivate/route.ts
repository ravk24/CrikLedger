import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const res = await pool.query(
      `UPDATE players SET is_active = TRUE WHERE id = $1
       RETURNING id, name, is_active`,
      [id],
    );
    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Player not found");
    }
    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error) {
    return handleRouteError("[players/reactivate]", error);
  }
}
