import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ApiError, editMatchSchema, handleRouteError } from "@/lib/validate";

// Fix a scheduled match's date/opponent/venue before it's played.
// Completed and abandoned matches are edited via the wizard, never here.
// opponent_captain edits the linked ground booking (resolved via
// matches.ground_booking_id).
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
        `SELECT opponent, ground_booking_id FROM matches
         WHERE id = $1 AND status = 'scheduled'
         FOR UPDATE`,
        [id],
      );
      if (!cur.rows[0]) {
        throw new ApiError(404, "NOT_FOUND", "Scheduled match not found");
      }

      // Absent venue = keep the stored value (the COALESCE below).
      const res = await client.query(
        `UPDATE matches
         SET match_date = $1, opponent = $2,
             venue = COALESCE($3, venue),
             updated_by = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING id, match_date, opponent, status`,
        [body.match_date, body.opponent, body.venue ?? null, admin.id, id],
      );

      // The booking resolves through the match's own link (the old
      // team_name = opponent heuristic died with tenancy); an unlinked
      // match simply has no booking captain to update.
      if (body.opponent_captain && cur.rows[0].ground_booking_id) {
        await client.query(
          `UPDATE ground_bookings SET captain = $1 WHERE id = $2`,
          [body.opponent_captain, cur.rows[0].ground_booking_id],
        );
      }

      return res.rows[0];
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[matches/schedule-edit]", error);
  }
}
