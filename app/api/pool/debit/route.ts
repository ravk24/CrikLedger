import { NextRequest, NextResponse } from "next/server";
import { pool, withTransaction } from "@/lib/db";
import { ceilSplit } from "@/engine/split";
import { requireAdmin } from "@/lib/session";
import { getCurrentTeamId } from "@/lib/team";
import { ApiError, handleRouteError, poolDebitSchema } from "@/lib/validate";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = poolDebitSchema.parse(await req.json());
    const teamId = await getCurrentTeamId(pool);

    if (!body.common) {
      const res = await pool.query(
        `INSERT INTO pool_entries (entry_date, kind, message, amount, created_by, team_id)
         VALUES (COALESCE($1::date, CURRENT_DATE), 'plain_debit', $2, $3, $4, $5)
         RETURNING id, entry_date, kind, message, amount`,
        [body.entry_date ?? null, body.message, -body.amount, admin.id, teamId],
      );
      return NextResponse.json(
        { success: true, data: res.rows[0] },
        { status: 201 },
      );
    }

    // Common debit: one transaction, fixed order — debit -> shares.
    // v1 money rule: shares hit player balances only; nothing is
    // auto-credited back to the pool.
    const result = await withTransaction(async (client) => {
      const playersRes = await client.query(
        `SELECT id FROM players WHERE team_id = $1 AND is_active ORDER BY id`,
        [teamId],
      );
      const activePlayers = playersRes.rows as { id: string }[];
      if (activePlayers.length === 0) {
        throw new ApiError(422, "NO_PLAYERS", "No active players to split across");
      }
      const split = ceilSplit(body.amount, activePlayers.length);

      const debitRes = await client.query(
        `INSERT INTO pool_entries (entry_date, kind, message, amount, created_by, team_id)
         VALUES (COALESCE($1::date, CURRENT_DATE), 'common_debit', $2, $3, $4, $5)
         RETURNING id`,
        [body.entry_date ?? null, body.message, -body.amount, admin.id, teamId],
      );
      const debitId = debitRes.rows[0].id;

      for (const player of activePlayers) {
        await client.query(
          `INSERT INTO expense_shares (pool_entry_id, player_id, amount, team_id)
           VALUES ($1, $2, $3, $4)`,
          [debitId, player.id, split.share, teamId],
        );
      }

      return {
        debit_id: debitId,
        share: split.share,
        players: split.players,
        charged: split.recovered,
      };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleRouteError("[pool/debit]", error);
  }
}
