import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { opponentLabel } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { ApiError, editMatchSchema, handleRouteError } from "@/lib/validate";

// Fix a scheduled match before it is played — including filling in what
// scheduling deliberately left blank, which is how a red-dot match gains
// an opponent and a fee. Completed and abandoned matches are edited via
// the wizard, never here.
//
// The fee is RECONCILED rather than appended: the match owns at most one
// linked pool entry (matches.other_fee_entry_id), so a changed amount
// updates it, a changed direction replaces it (the kind and sign both
// differ), and a removed fee deletes it.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = editMatchSchema.parse(await req.json());

    const result = await withTransaction(async (client) => {
      const cur = await client.query(
        `SELECT opponent, venue, ground_booking_id, other_fee_entry_id, fee_direction
         FROM matches
         WHERE id = $1 AND status = 'scheduled'
         FOR UPDATE`,
        [id],
      );
      const match = cur.rows[0];
      if (!match) {
        throw new ApiError(404, "NOT_FOUND", "Scheduled match not found");
      }

      const feeAmount = body.fee_amount ?? 0;
      const feePending = body.fee_pending ?? 0;
      const settled = feeAmount - feePending;
      const wantsEntry = !!body.fee_direction && settled > 0;
      const directionChanged = match.fee_direction !== (body.fee_direction ?? null);

      // Drop the old entry when the fee is gone or its direction flipped.
      let entryId: string | null = match.other_fee_entry_id;
      if (entryId && (!wantsEntry || directionChanged)) {
        await client.query(`DELETE FROM pool_entries WHERE id = $1`, [entryId]);
        entryId = null;
      }

      if (wantsEntry) {
        const isDebit = body.fee_direction === "debit";
        const amount = isDebit ? -settled : settled;
        const message =
          `Match fee — vs ${opponentLabel(body.opponent ?? match.opponent)}` +
          (body.venue ?? match.venue ? ` at ${body.venue ?? match.venue}` : "");
        if (entryId) {
          await client.query(
            `UPDATE pool_entries SET amount = $1, message = $2 WHERE id = $3`,
            [amount, message, entryId],
          );
        } else {
          const entryRes = await client.query(
            `INSERT INTO pool_entries (kind, message, amount, created_by, team_id)
             SELECT $1, $2, $3, $4, team_id FROM matches WHERE id = $5
             RETURNING id`,
            [
              isDebit ? "plain_debit" : "other_income",
              message,
              amount,
              admin.id,
              id,
            ],
          );
          entryId = entryRes.rows[0].id;
        }
      }

      // Absent venue/opponent keep the stored value; the fee columns are
      // authoritative because the form always submits the whole block.
      const res = await client.query(
        `UPDATE matches
         SET match_date = $1,
             opponent = COALESCE($2, opponent),
             venue = COALESCE($3, venue),
             fee_direction = $4,
             fee_pending = $5,
             other_fee_entry_id = $6,
             updated_by = $7, updated_at = NOW()
         WHERE id = $8
         RETURNING id, match_date, opponent, status`,
        [
          body.match_date,
          body.opponent ?? null,
          body.venue ?? null,
          body.fee_direction ?? null,
          feePending,
          entryId,
          admin.id,
          id,
        ],
      );

      // The booking resolves through the match's own link (the old
      // team_name = opponent heuristic died with tenancy); an unlinked
      // match simply has no booking captain to update.
      if (body.opponent_captain && match.ground_booking_id) {
        await client.query(
          `UPDATE ground_bookings SET captain = $1 WHERE id = $2`,
          [body.opponent_captain, match.ground_booking_id],
        );
      }

      return res.rows[0];
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[matches/schedule-edit]", error);
  }
}
