import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { opponentLabel } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { createMatchSchema, handleRouteError } from "@/lib/validate";

// One scheduling flow. Date and ground are all that is required — a
// match can go on the calendar before an opponent is known, and before
// any money is agreed. When a fee IS given it moves in one declared
// direction, and only the settled part reaches the pool now: a pending
// slice is held on matches.fee_pending until someone clears it.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = createMatchSchema.parse(await req.json());
    const teamId = admin.scopeId;

    const feeAmount = body.fee_amount ?? 0;
    const feePending = body.fee_pending ?? 0;
    const settled = feeAmount - feePending;

    const result = await withTransaction(async (client) => {
      // A fully pending fee has nothing to post yet — the entry is
      // written when the remainder is cleared. pool_entries' sign CHECK
      // rejects a zero amount either way, so guard on settled > 0.
      let entryId: string | null = null;
      if (body.fee_direction && settled > 0) {
        const isDebit = body.fee_direction === "debit";
        const message =
          `Match fee — vs ${opponentLabel(body.opponent)}` +
          (body.venue ? ` at ${body.venue}` : "");
        const entryRes = await client.query(
          `INSERT INTO pool_entries (kind, message, amount, created_by, team_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            isDebit ? "plain_debit" : "other_income",
            message,
            isDebit ? -settled : settled,
            admin.id,
            teamId,
          ],
        );
        entryId = entryRes.rows[0].id;
      }

      const matchRes = await client.query(
        `INSERT INTO matches
           (match_date, opponent, venue, fee_direction, fee_pending,
            other_fee_entry_id, created_by, team_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, match_date, opponent, status`,
        [
          body.match_date,
          body.opponent ?? null,
          body.venue ?? null,
          body.fee_direction ?? null,
          feePending,
          entryId,
          admin.id,
          teamId,
        ],
      );
      return { ...matchRes.rows[0], fee_recorded: settled };
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleRouteError("[matches/schedule]", error);
  }
}
