import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ApiError, addPlayerSchema, handleRouteError } from "@/lib/validate";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "23505"
  );
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { name } = addPlayerSchema.parse(await req.json());

    const teamId = admin.scopeId;

    try {
      const res = await pool.query(
        `INSERT INTO players (name, team_id) VALUES ($1, $2)
         RETURNING id, name, is_active`,
        [name, teamId],
      );
      return NextResponse.json(
        { success: true, data: res.rows[0] },
        { status: 201 },
      );
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
    return handleRouteError("[players]", error);
  }
}
