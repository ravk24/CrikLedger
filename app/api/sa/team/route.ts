import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireTeamSuperadmin } from "@/lib/session";
import { handleRouteError, teamNameSchema } from "@/lib/validate";

// The superadmin renames their own team. Only display_name moves — the
// slug is the cookie/URL key and stays put, so nothing bookmarked breaks.
export async function PATCH(req: NextRequest) {
  try {
    const superadmin = await requireTeamSuperadmin();
    const { display_name } = teamNameSchema.parse(await req.json());
    const res = await pool.query<{ id: string; display_name: string }>(
      `UPDATE teams SET display_name = $1 WHERE id = $2
       RETURNING id, display_name`,
      [display_name, superadmin.scopeId],
    );
    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error) {
    return handleRouteError("[sa/team]", error);
  }
}
