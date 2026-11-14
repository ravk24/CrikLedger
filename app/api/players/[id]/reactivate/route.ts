import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireTeamRowWrite } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Authorized against the PLAYER's team, not the active one (F-1).
    const admin = await requireTeamRowWrite("players", id);

    const res = await pool.query(
      `UPDATE players SET is_active = TRUE WHERE id = $1 AND team_id = $2
       RETURNING id, name, is_active`,
      [id, admin.scopeId],
    );
    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Player not found");
    }
    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error) {
    return handleRouteError("[players/reactivate]", error);
  }
}
