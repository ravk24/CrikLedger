import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { pool } from "@/lib/db";
import { requireTeamSuperadmin } from "@/lib/session";
import { ApiError, groundSchema, handleRouteError } from "@/lib/validate";

// Ground presets (migration 51): superadmin only, scoped to the caller's
// active team. Presets move prefills only — a completed match keeps the
// allowance it was confirmed with — so nothing here touches money.
//
// lib/team.ts caches the list per team (the picker and the wizard read
// it); every write revalidates the tag so the next request sees it.
// The sibling [id] route carries edit, hide/show and remove.

type GroundRow = {
  id: string;
  name: string;
  car_allowance: number;
  is_active: boolean;
};

export async function GET() {
  try {
    const superadmin = await requireTeamSuperadmin();
    const res = await pool.query<GroundRow>(
      `SELECT id, name, car_allowance::int AS car_allowance, is_active
         FROM team_grounds
        WHERE team_id = $1
        ORDER BY is_active DESC, name ASC`,
      [superadmin.scopeId],
    );
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error) {
    return handleRouteError("[sa/grounds]", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const superadmin = await requireTeamSuperadmin();
    const { name, car_allowance } = groundSchema.parse(await req.json());
    const res = await pool
      .query<{ id: string }>(
        `INSERT INTO team_grounds (team_id, name, car_allowance, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [superadmin.scopeId, name, car_allowance, superadmin.id],
      )
      .catch((err: { code?: string; constraint?: string }) => {
        if (err.code === "23505") {
          throw new ApiError(
            409,
            "GROUND_EXISTS",
            "A ground with this name already exists — edit that one instead",
          );
        }
        throw err;
      });
    revalidateTag(`team-grounds:${superadmin.scopeId}`, "max");
    return NextResponse.json(
      { success: true, data: { id: res.rows[0].id } },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError("[sa/grounds]", error);
  }
}
