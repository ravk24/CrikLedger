import { NextRequest, NextResponse } from "next/server";
import { pool, withTransaction } from "@/lib/db";
import { buildBookingMessage } from "@/lib/bookings";
import { requireAdmin } from "@/lib/session";
import { getCurrentTeamId } from "@/lib/team";
import {
  ApiError,
  handleRouteError,
  groundBookingSchema,
  poolCreditSchema,
} from "@/lib/validate";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const raw = await req.json();

    if (raw?.kind === "ground_booking") {
      const body = groundBookingSchema.parse(raw);

      // One transaction: credit (if anything was paid) -> booking -> matches.
      const result = await withTransaction(async (client) => {
        const teamId = await getCurrentTeamId(client);
        const message = buildBookingMessage(
          body.team_name,
          body.captain,
          body.slots,
          body.amount_pending,
        );

        let entryId: string | null = null;
        if (body.amount_paid > 0) {
          const entryRes = await client.query(
            `INSERT INTO pool_entries (entry_date, kind, message, amount, created_by, team_id)
             VALUES (COALESCE($1::date, CURRENT_DATE), 'ground_booking', $2, $3, $4, $5)
             RETURNING id`,
            [body.entry_date ?? null, message, body.amount_paid, admin.id, teamId],
          );
          entryId = entryRes.rows[0].id;
        }

        const bookingRes = await client.query(
          `INSERT INTO ground_bookings
             (pool_entry_id, team_name, captain, slots, amount_paid, amount_pending, created_by, team_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            entryId,
            body.team_name,
            body.captain,
            body.slots,
            body.amount_paid,
            body.amount_pending,
            admin.id,
            teamId,
          ],
        );

        for (const matchDate of body.match_dates) {
          await client.query(
            `INSERT INTO matches
               (match_date, opponent, status, created_by, ground_booking_id, team_id)
             VALUES ($1, $2, 'scheduled', $3, $4, $5)`,
            [matchDate, body.team_name, admin.id, bookingRes.rows[0].id, teamId],
          );
        }

        return {
          booking_id: bookingRes.rows[0].id,
          entry_id: entryId,
          matches_created: body.match_dates.length,
        };
      });

      return NextResponse.json({ success: true, data: result }, { status: 201 });
    }

    const body = poolCreditSchema.parse(raw);
    const teamId = await getCurrentTeamId(pool);

    const playerLinked = body.kind === "deposit" || body.kind === "opening_due";
    if (playerLinked) {
      const player = await pool.query(
        `SELECT 1 FROM players WHERE id = $1 AND team_id = $2 AND is_active`,
        [body.player_id, teamId],
      );
      if (player.rowCount === 0) {
        throw new ApiError(422, "INACTIVE_PLAYER", "Player not found or inactive");
      }
    }

    const res = await pool.query(
      `INSERT INTO pool_entries (entry_date, kind, message, amount, player_id, created_by, team_id)
       VALUES (COALESCE($1::date, CURRENT_DATE), $2, $3, $4, $5, $6, $7)
       RETURNING id, entry_date, kind, message, amount`,
      [
        body.entry_date ?? null,
        body.kind,
        // Player-linked rows may omit the message — the column is NOT
        // NULL, and their ledger titles derive from the player anyway.
        body.message ?? "",
        // Credits are positive by convention; an opening due is a debt
        // carried from last season — stored negative against the player.
        body.kind === "opening_due" ? -body.amount : body.amount,
        playerLinked ? body.player_id : null,
        admin.id,
        teamId,
      ],
    );

    return NextResponse.json(
      { success: true, data: res.rows[0] },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError("[pool/credit]", error);
  }
}
