import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { isPlayerLinked } from "@/lib/poolKinds";
import { requireAdmin } from "@/lib/session";
import { ApiError, handleRouteError, poolCreditSchema } from "@/lib/validate";

// Credits only: a player deposit or other income. Everything that lowers
// the pool — expenses, withdrawals, season dues — goes through
// /api/pool/debit. (The ground-booking branch was retired 2026-09-16;
// old 'ground_booking' rows stay in the ledger as legacy.)
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    // Already on the session row — never re-resolve it.
    const teamId = admin.scopeId;
    const body = poolCreditSchema.parse(await req.json());

    const playerLinked = isPlayerLinked(body.kind);
    if (playerLinked) {
      const player = await pool.query(
        `SELECT 1 FROM players WHERE id = $1 AND team_id = $2 AND is_active`,
        [body.player_id, teamId],
      );
      if (player.rowCount === 0) {
        throw new ApiError(422, "INACTIVE_PLAYER", "Player not found or inactive");
      }
    }

    const res = await pool.query(
      `INSERT INTO pool_entries (entry_date, kind, message, amount, player_id, created_by, team_id)
       VALUES (COALESCE($1::date, CURRENT_DATE), $2, $3, $4, $5, $6, $7)
       RETURNING id, entry_date, kind, message, amount`,
      [
        body.entry_date ?? null,
        body.kind,
        // Player-linked rows may omit the message — the column is NOT
        // NULL, and their ledger titles derive from the player anyway.
        body.message ?? "",
        // Credits are positive by convention (sign_matches_kind).
        body.amount,
        playerLinked ? body.player_id : null,
        admin.id,
        teamId,
      ],
    );

    return NextResponse.json(
      { success: true, data: res.rows[0] },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError("[pool/credit]", error);
  }
}
