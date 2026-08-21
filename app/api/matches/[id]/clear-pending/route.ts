import { NextRequest, NextResponse } from "next/server";
import { pool, withTransaction } from "@/lib/db";
import { clearBookingPending } from "@/lib/bookings";
import { clearMatchPending } from "@/lib/matches";
import { requireAdmin } from "@/lib/session";
import { clearPendingSchema, handleRouteError } from "@/lib/validate";

// Any admin — the outstanding match fee arrived (or went out). One-way:
// zeroes the pending amount, posts it to the pool, and unlocks
// completion of the match.
//
// Two sources of a pending fee, so two paths. A legacy booking-linked
// match settles through the booking (its share telescopes across the
// booking's other matches); every other match carries the fee itself on
// matches.fee_pending since migration 36.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = clearPendingSchema.parse(await req.json());

    const linked = await pool.query(
      `SELECT ground_booking_id FROM matches WHERE id = $1`,
      [id],
    );

    const result = await withTransaction((client) =>
      linked.rows[0]?.ground_booking_id
        ? clearBookingPending(client, admin.id, id, body.expected_pending)
        : clearMatchPending(client, admin.id, id, body.expected_pending),
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[matches/clear-pending]", error);
  }
}
