import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { deleteScheduledMatchWithFees } from "@/lib/matches";
import { requireSuperadmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

// Superadmin only — the opponent cancelled a scheduled match. Deletes
// the match and reverses its fee entries (settled and cleared-pending),
// so the pool ends where it was before scheduling. Completed matches
// keep their own DELETE.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSuperadmin();
    const { id } = await params;

    const result = await withTransaction(async (client) => {
      const cur = await client.query(
        `SELECT id, other_fee_entry_id, pending_cleared_entry_id, fee_direction
         FROM matches
         WHERE id = $1 AND status = 'scheduled'
         FOR UPDATE`,
        [id],
      );
      const match = cur.rows[0];
      if (!match) {
        const probe = await client.query(
          `SELECT status FROM matches WHERE id = $1`,
          [id],
        );
        if (probe.rows[0]) {
          throw new ApiError(
            409,
            "NOT_SCHEDULED",
            "Only scheduled matches can be cancelled",
          );
        }
        throw new ApiError(404, "NOT_FOUND", "Match not found");
      }

      // Deleting the linked entries is the correct reversal in either
      // direction: a debit the pool fronted comes back, a credit it
      // received goes away. fee_direction only decides the wording.
      const { fee_reverted: feeReverted } = await deleteScheduledMatchWithFees(
        client,
        match,
      );
      return {
        fee_reverted: feeReverted,
        fee_direction: match.fee_direction as "credit" | "debit" | null,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[matches/cancel]", error);
  }
}
