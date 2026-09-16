import { NextRequest, NextResponse } from "next/server";
import { pool, withTransaction } from "@/lib/db";
import { ceilSplit } from "@/engine/split";
import { requireAdmin } from "@/lib/session";
import { ApiError, handleRouteError, poolDebitSchema } from "@/lib/validate";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = poolDebitSchema.parse(await req.json());
    const teamId = admin.scopeId;

    if (body.kind === "withdrawal" || body.kind === "opening_due") {
      // The two player-linked debits. A withdrawal is a player taking part
      // of their deposit back (migration 55); a season due is last
      // season's debt carried against a player (migration 8; entered
      // from the Debit sheet since 2026-09-16). Both need an active
      // same-team player and are stored negative so they lower the pool
      // and the player's balance together. Locking the player row
      // serialises two concurrent withdrawals so the balance check below
      // cannot be raced past.
      const result = await withTransaction(async (client) => {
        const playerRes = await client.query(
          `SELECT p.name, b.balance
           FROM players p
           JOIN player_balances b ON b.id = p.id AND b.team_id = p.team_id
           WHERE p.id = $1 AND p.team_id = $2 AND p.is_active
           FOR UPDATE OF p`,
          [body.player_id, teamId],
        );
        const player = playerRes.rows[0] as
          | { name: string; balance: string | number }
          | undefined;
        if (!player) {
          throw new ApiError(422, "INACTIVE_PLAYER", "Player not found or inactive");
        }
        // Owner's rule: a player cannot take out more than they hold. The
        // pool itself is not guarded — like any plain debit it may dip
        // below zero (R-40: the pool runs ahead of the cash box). A season
        // due records a debt, not cash leaving, so it skips the check.
        const balance = Math.round(Number(player.balance));
        if (body.kind === "withdrawal" && body.amount > balance) {
          throw new ApiError(
            422,
            "EXCEEDS_BALANCE",
            `${player.name}'s balance is ₹${balance.toLocaleString("en-IN")} — a withdrawal cannot exceed it`,
          );
        }
        const res = await client.query(
          `INSERT INTO pool_entries (entry_date, kind, message, amount, player_id, created_by, team_id)
           VALUES (COALESCE($1::date, CURRENT_DATE), $2, $3, $4, $5, $6, $7)
           RETURNING id, entry_date, kind, message, amount`,
          [
            body.entry_date ?? null,
            body.kind,
            // Titles itself from the player; the column is NOT NULL.
            body.message ?? "",
            -body.amount,
            body.player_id,
            admin.id,
            teamId,
          ],
        );
        return res.rows[0];
      });
      return NextResponse.json({ success: true, data: result }, { status: 201 });
    }

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

      await client.query(
        `INSERT INTO expense_shares (pool_entry_id, player_id, amount, team_id)
         SELECT $1, p, $3, $4 FROM unnest($2::uuid[]) AS p`,
        [debitId, activePlayers.map((p) => p.id), split.share, teamId],
      );

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
