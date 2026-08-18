import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { revertBookingShare } from "@/lib/bookings";
import { requireSuperadmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

// Superadmin only — the opponent cancelled a scheduled match. Deletes
// the match (freeing its slot on the Available Slots page) and returns
// its slot share to the ledger: the booking loses one slot and the
// BOOKING credit shrinks by the per-slot share. The captain settles the
// opponent's cash offline. Completed matches keep their own DELETE.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireSuperadmin();
    const { id } = await params;

    const result = await withTransaction(async (client) => {
      const cur = await client.query(
        `SELECT ground_booking_id, other_fee_entry_id FROM matches
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

      await client.query(`DELETE FROM matches WHERE id = $1`, [id]);

      const reverted = await revertBookingShare(
        client,
        admin.id,
        match.ground_booking_id,
      );

      // Other match: the pool-fronted ground fee returns — delete its
      // debit row (a match is never both booking-linked and other).
      let feeReverted = 0;
      if (match.other_fee_entry_id) {
        const feeRes = await client.query(
          `DELETE FROM pool_entries WHERE id = $1 RETURNING amount`,
          [match.other_fee_entry_id],
        );
        feeReverted = Math.abs(Number(feeRes.rows[0]?.amount ?? 0));
      }
      return {
        booking_share:
          (reverted?.paidShare ?? 0) + (reverted?.clearedShare ?? 0),
        fee_reverted: feeReverted,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[matches/cancel]", error);
  }
}
