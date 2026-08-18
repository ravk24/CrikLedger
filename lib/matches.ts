import { withTransaction } from "@/lib/db";
import { calculateMatchFees } from "@/engine/calc";
import { ApiError } from "@/lib/validate";
import type { z } from "zod";
import type { matchSubmitSchema } from "@/lib/validate";

type SubmitBody = z.infer<typeof matchSubmitSchema>;

// Complete OR edit a match — identical semantics (kickoff §6). Derived
// balances make reversal free: participants are replaced wholesale and
// the surplus row is upserted (or removed), never duplicated.
// v2 money rules: guests count in the split; their charges land on the
// standing captain's balance (merged into his row when he plays, else
// an is_playing = FALSE row). Only the rounding surplus (collected −
// cash costs) is auto-credited to the pool.
export async function completeMatch(
  matchId: string,
  adminId: string,
  body: SubmitBody,
): Promise<{
  collected: number;
  surplus: number;
  recouped: number; // pool-fronted ground share recouped (other matches)
  credited: number; // actual match_collection amount (0 = row removed)
  guestFee: number;
  captainName: string | null;
}> {
  // The guest charge is canonical — recomputed from costs and heads,
  // never taken from the client, and unaffected by per-player fee edits.
  const canonical = calculateMatchFees({
    groundFee: body.ground_fee,
    ballFee: body.ball_fee,
    otherFee: body.other_fee,
    carAllowancePerCar: body.car_allowance_per_car,
    attendees: body.rows.map((r) => ({
      playerId: r.player_id,
      broughtCar: r.brought_car,
    })),
    guests: body.guests.map((g) => ({
      name: g.name,
      broughtCar: g.brought_car,
    })),
  });
  const guestFee = canonical.captainCharge;

  const collected =
    body.rows.reduce((sum, r) => sum + r.fee, 0) + guestFee;
  if (collected <= 0) {
    throw new ApiError(
      422,
      "NEGATIVE_COLLECTION",
      "Total collected must be above zero",
    );
  }
  // Drivers are already netted inside collected, and drivers keep their
  // allowance — so the pool's gain is measured against cash costs only.
  const cashCosts = body.ground_fee + body.ball_fee + body.other_fee;
  const surplus = collected - cashCosts;

  return withTransaction(async (client) => {
    const matchRes = await client.query(
      `SELECT id, status, opponent, match_date, ground_booking_id,
              other_fee_entry_id, team_id
       FROM matches WHERE id = $1`,
      [matchId],
    );
    const match = matchRes.rows[0];
    if (!match) {
      throw new ApiError(404, "NOT_FOUND", "Match not found");
    }
    if (match.status === "abandoned") {
      throw new ApiError(409, "ABANDONED", "An abandoned match has no fees");
    }
    // Scheduled → completed only: the booking's pending fee must be
    // cleared first. FOR UPDATE serializes against a concurrent clear.
    if (match.status === "scheduled" && match.ground_booking_id) {
      const feeRes = await client.query(
        `SELECT amount_pending FROM ground_bookings WHERE id = $1 FOR UPDATE`,
        [match.ground_booking_id],
      );
      if (Number(feeRes.rows[0]?.amount_pending ?? 0) > 0) {
        throw new ApiError(
          409,
          "PENDING_FEE",
          "Clear the pending match fee before completing this match",
        );
      }
    }

    const playerIds = body.rows.map((r) => r.player_id);
    const uniqueIds = [...new Set(playerIds)];
    if (uniqueIds.length !== playerIds.length) {
      throw new ApiError(
        422,
        "DUPLICATE_PLAYER",
        "Each player can appear only once",
      );
    }
    const activeRes = await client.query(
      `SELECT id FROM players
       WHERE id = ANY($1::uuid[]) AND team_id = $2 AND is_active`,
      [uniqueIds, match.team_id],
    );
    if (activeRes.rowCount !== uniqueIds.length) {
      throw new ApiError(
        422,
        "INACTIVE_PLAYER",
        "Every attendee must be an active player",
      );
    }

    // Guests require a standing captain to absorb their fees.
    let captain: { id: string; name: string } | null = null;
    if (body.guests.length > 0) {
      const capRes = await client.query(
        `SELECT id, name FROM players
         WHERE team_id = $1 AND is_captain AND is_active`,
        [match.team_id],
      );
      captain = capRes.rows[0] ?? null;
      if (!captain) {
        throw new ApiError(
          422,
          "NO_CAPTAIN",
          "Declare a captain first (superadmin → Players) — guest fees are deducted from the captain",
        );
      }
    }

    // Fixed order: match update -> participants replace -> collection upsert.
    await client.query(
      `UPDATE matches
       SET status = 'completed', result = $2,
           ground_fee = $3, ball_fee = $4, other_fee = $5,
           car_allowance_per_car = $6, guest_names = $7, guest_cars = $8,
           updated_by = $9, updated_at = NOW()
       WHERE id = $1`,
      [
        matchId,
        body.result,
        body.ground_fee,
        body.ball_fee,
        body.other_fee,
        body.car_allowance_per_car,
        body.guests.map((g) => g.name),
        body.guests.map((g) => g.brought_car),
        adminId,
      ],
    );

    await client.query(`DELETE FROM match_participants WHERE match_id = $1`, [
      matchId,
    ]);
    const captainPlaying =
      captain !== null && body.rows.some((r) => r.player_id === captain.id);
    for (const row of body.rows) {
      const isCaptainRow = captain !== null && row.player_id === captain.id;
      const share = isCaptainRow ? guestFee : 0;
      await client.query(
        `INSERT INTO match_participants
           (match_id, player_id, brought_car, fee_amount, guest_fee_share, is_playing, team_id)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
        [matchId, row.player_id, row.brought_car, row.fee + share, share,
         match.team_id],
      );
    }
    // Captain absent but charged: a charge-only row keeps balances and
    // statements derived from one place.
    if (captain && !captainPlaying && guestFee !== 0) {
      await client.query(
        `INSERT INTO match_participants
           (match_id, player_id, brought_car, fee_amount, guest_fee_share, is_playing, team_id)
         VALUES ($1, $2, FALSE, $3, $3, FALSE, $4)`,
        [matchId, captain.id, guestFee, match.team_id],
      );
    }

    // Other matches: the pool fronted the ground contribution at
    // scheduling (linked plain_debit), so completion recoups it from the
    // players' collected fees ON TOP of the usual roundoff surplus —
    // pool nets to +surplus over the match's life. Read the entry's
    // CURRENT amount (admins may have edited it in the ledger); a
    // hand-deleted entry NULLs the link and recoups nothing.
    let recouped = 0;
    if (match.other_fee_entry_id) {
      const feeRes = await client.query(
        `SELECT amount FROM pool_entries WHERE id = $1 FOR UPDATE`,
        [match.other_fee_entry_id],
      );
      recouped = Math.abs(Number(feeRes.rows[0]?.amount ?? 0));
    }
    const credit = surplus + recouped;

    // Only a positive credit lands in the pool (the amount CHECK rejects
    // 0/negative anyway). Edits that erase it remove the row.
    if (credit > 0) {
      await client.query(
        `INSERT INTO pool_entries (entry_date, kind, message, amount, match_id, created_by, team_id)
         VALUES ($1, 'match_collection', $2, $3, $4, $5, $6)
         ON CONFLICT (match_id) DO UPDATE
         SET amount = EXCLUDED.amount,
             message = EXCLUDED.message,
             entry_date = EXCLUDED.entry_date,
             updated_by = $5,
             updated_at = NOW()`,
        [
          match.match_date,
          recouped > 0
            ? `Match collection vs ${match.opponent}`
            : `Match surplus vs ${match.opponent}`,
          credit,
          matchId,
          adminId,
          match.team_id,
        ],
      );
    } else {
      await client.query(`DELETE FROM pool_entries WHERE match_id = $1`, [
        matchId,
      ]);
    }

    return {
      collected,
      surplus,
      recouped,
      credited: credit > 0 ? credit : 0,
      guestFee,
      captainName: captain?.name ?? null,
    };
  });
}
