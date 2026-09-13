import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { opponentLabel } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { ApiError, abandonMatchSchema, handleRouteError } from "@/lib/validate";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { reason } = abandonMatchSchema.parse(await req.json());

    const result = await withTransaction(async (client) => {
      // Allowed from scheduled only. Home: zero financials. Away: the
      // pool-fronted ground fee comes back — but the debit rows STAY
      // (settled slice + any cleared-pending slice); a locked
      // match_refund row reverses their sum so the ledger reads
      // "fee charged, fee returned, match cancelled" (migration 54).
      const res = await client.query(
        `UPDATE matches
         SET status = 'abandoned', abandoned_reason = $2,
             updated_by = $3, updated_at = NOW()
         WHERE id = $1 AND status = 'scheduled'
         RETURNING id, status, team_id, opponent,
                   other_fee_entry_id, pending_cleared_entry_id`,
        [id, reason, admin.id],
      );
      const row = res.rows[0];
      if (!row) {
        throw new ApiError(
          409,
          "NOT_SCHEDULED",
          "Only a scheduled match can be abandoned",
        );
      }

      const feeIds = [row.other_fee_entry_id, row.pending_cleared_entry_id]
        .filter((x): x is string => Boolean(x));
      let feeReverted = 0;
      if (feeIds.length > 0) {
        // Lock the fee rows: their amounts are baked into the refund
        // from here on (the ledger routes refuse to edit them once the
        // match is abandoned, same as completed).
        // (Postgres refuses FOR UPDATE on an aggregate, so sum here.)
        const feeRes = await client.query<{ amount: string }>(
          `SELECT amount FROM pool_entries WHERE id = ANY($1::uuid[]) FOR UPDATE`,
          [feeIds],
        );
        const total = feeRes.rows.reduce((sum, r) => sum + Number(r.amount), 0);
        if (total !== 0) {
          const refund = await client.query<{ id: string }>(
            `INSERT INTO pool_entries (kind, message, amount, created_by, team_id)
             VALUES ('match_refund', $1, $2, $3, $4)
             RETURNING id`,
            [
              `Match fee returned — vs ${opponentLabel(row.opponent)}`,
              -total,
              admin.id,
              row.team_id,
            ],
          );
          await client.query(
            `UPDATE matches SET refund_entry_id = $2 WHERE id = $1`,
            [row.id, refund.rows[0].id],
          );
          feeReverted = Math.abs(total);
        }
      }
      return { id: row.id, status: row.status, fee_reverted: feeReverted };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[matches/abandon]", error);
  }
}
