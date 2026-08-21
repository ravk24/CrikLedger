import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

// Superadmin only — the captain is a standing role for the whole
// TEAM (not per match). Exactly one per team: declaring a new
// captain replaces that team's previous one atomically.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // The team id rides the session row; resolving it INSIDE the
    // transaction used to open a second pooled connection while the
    // first was held — three concurrent calls could deadlock the pool.
    const { scopeId: teamId } = await requireSuperadmin();
    const { id } = await params;

    const result = await withTransaction(async (client) => {
      await client.query(
        `UPDATE players SET is_captain = FALSE
         WHERE team_id = $1 AND is_captain`,
        [teamId],
      );
      const res = await client.query(
        `UPDATE players SET is_captain = TRUE, is_vice_captain = FALSE
         WHERE id = $1 AND team_id = $2 AND is_active
         RETURNING id, name`,
        [id, teamId],
      );
      const row = res.rows[0];
      if (!row) {
        throw new ApiError(
          422,
          "NOT_ACTIVE",
          "Captain must be an active player",
        );
      }
      return row;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[players/captain]", error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSuperadmin();
    const { id } = await params;

    const res = await withTransaction((client) =>
      client.query(
        `UPDATE players SET is_captain = FALSE
         WHERE id = $1 AND is_captain
         RETURNING id, name`,
        [id],
      ),
    );
    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "This player is not the captain");
    }
    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error) {
    return handleRouteError("[players/captain]", error);
  }
}
