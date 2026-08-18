import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ApiError, editPlayerSchema, handleRouteError } from "@/lib/validate";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "23505"
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = editPlayerSchema.parse(await req.json());

    try {
      const res = await pool.query(
        `UPDATE players
         SET name = COALESCE($2, name)
         WHERE id = $1
         RETURNING id, name, is_active`,
        [id, body.name ?? null],
      );
      if (res.rowCount === 0) {
        throw new ApiError(404, "NOT_FOUND", "Player not found");
      }
      return NextResponse.json({ success: true, data: res.rows[0] });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiError(
          409,
          "NAME_TAKEN",
          "A player with this name already exists",
        );
      }
      throw error;
    }
  } catch (error) {
    return handleRouteError("[players/edit]", error);
  }
}
