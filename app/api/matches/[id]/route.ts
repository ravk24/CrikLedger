import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { revertBookingShare } from "@/lib/bookings";
import { completeMatch } from "@/lib/matches";
import { requireAdmin, requireSuperadmin } from "@/lib/session";
import { ApiError, handleRouteError, matchSubmitSchema } from "@/lib/validate";

// Edit — identical payload and semantics to submit.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = matchSubmitSchema.parse(await req.json());
    const result = await completeMatch(id, admin.id, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[matches/edit]", error);
  }
}

// Superadmin only — destructive. Participants and the collection row
// cascade via FKs; a booking match also returns its slot share to the
// ledger (the captain settles the opponent's cash offline).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireSuperadmin();
    const { id } = await params;

    await withTransaction(async (client) => {
      const cur = await client.query(
        `SELECT ground_booking_id, other_fee_entry_id
         FROM matches WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const match = cur.rows[0];
      if (!match) {
        throw new ApiError(404, "NOT_FOUND", "Match not found");
      }
      await client.query(`DELETE FROM matches WHERE id = $1`, [id]);
      await revertBookingShare(client, admin.id, match.ground_booking_id);
      // Participants and the collection credit cascade with the match;
      // deleting the linked fee entry completes the full reversal in
      // either direction — the pool ends where it was before scheduling.
      if (match.other_fee_entry_id) {
        await client.query(`DELETE FROM pool_entries WHERE id = $1`, [
          match.other_fee_entry_id,
        ]);
      }
    });

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleRouteError("[matches/delete]", error);
  }
}
