import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { pool } from "@/lib/db";
import { requireTeamSuperadmin } from "@/lib/session";
import { ApiError, editGroundSchema, handleRouteError } from "@/lib/validate";

// One ground preset: rename / re-price / hide / show (PATCH) and remove
// (DELETE). Both are scoped by team_id in the WHERE, so an id from
// another team is simply "not found". Neither touches a match — the
// venue on a match is free text and the allowance is snapshotted.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const superadmin = await requireTeamSuperadmin();
    const { id } = await params;
    const body = editGroundSchema.parse(await req.json());
    const res = await pool
      .query<{ id: string }>(
        `UPDATE team_grounds
            SET name = COALESCE($3, name),
                car_allowance = COALESCE($4, car_allowance),
                is_active = COALESCE($5, is_active),
                updated_at = NOW()
          WHERE id = $1 AND team_id = $2
        RETURNING id`,
        [
          id,
          superadmin.scopeId,
          body.name ?? null,
          body.car_allowance ?? null,
          body.is_active ?? null,
        ],
      )
      .catch((err: { code?: string }) => {
        if (err.code === "23505") {
          throw new ApiError(
            409,
            "GROUND_EXISTS",
            "A ground with this name already exists — edit that one instead",
          );
        }
        throw err;
      });
    if (!res.rows[0]) {
      throw new ApiError(404, "NOT_FOUND", "Ground not found");
    }
    revalidateTag(`team-grounds:${superadmin.scopeId}`, "max");
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return handleRouteError("[sa/grounds/id]", error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const superadmin = await requireTeamSuperadmin();
    const { id } = await params;
    const res = await pool.query(
      `DELETE FROM team_grounds WHERE id = $1 AND team_id = $2`,
      [id, superadmin.scopeId],
    );
    if ((res.rowCount ?? 0) === 0) {
      throw new ApiError(404, "NOT_FOUND", "Ground not found");
    }
    revalidateTag(`team-grounds:${superadmin.scopeId}`, "max");
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleRouteError("[sa/grounds/id]", error);
  }
}
