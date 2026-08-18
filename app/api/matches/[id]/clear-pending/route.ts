import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { clearBookingPending } from "@/lib/bookings";
import { requireAdmin } from "@/lib/session";
import { clearPendingSchema, handleRouteError } from "@/lib/validate";

// Any admin — the opponent's remaining match fee arrived. One-way:
// zeroes the booking's pending amount and credits it to the pool as a
// new BOOKING entry; completion of the match unlocks.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = clearPendingSchema.parse(await req.json());

    const result = await withTransaction((client) =>
      clearBookingPending(client, admin.id, id, body.expected_pending),
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[matches/clear-pending]", error);
  }
}
