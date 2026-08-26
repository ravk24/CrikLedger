import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { clearMatchPending } from "@/lib/matches";
import { requireAdmin } from "@/lib/session";
import { clearPendingSchema, handleRouteError } from "@/lib/validate";

// Any admin — the outstanding match fee arrived (or went out). One-way:
// zeroes the pending amount, posts it to the pool, and unlocks
// completion of the match. The match carries the fee itself on
// matches.fee_pending (migration 36); clearMatchPending locks the row
// FOR UPDATE as its first statement, so there is no probe outside the
// transaction.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = clearPendingSchema.parse(await req.json());

    const result = await withTransaction((client) =>
      clearMatchPending(client, admin.id, id, body.expected_pending),
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[matches/clear-pending]", error);
  }
}
