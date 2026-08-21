import { withTransaction } from "@/lib/db";
import { opponentLabel } from "@/lib/format";
import { calculateMatchFees } from "@/engine/calc";
import { ApiError } from "@/lib/validate";
import type { PoolClient } from "pg";
import type { z } from "zod";
import type { matchSubmitSchema } from "@/lib/validate";

type SubmitBody = z.infer<typeof matchSubmitSchema>;

// match_id -> attendee count, for the match lists. A charge-only
// captain row (is_playing = FALSE, carrying the guests' fee share) is
// not attendance, so it never counts. Shared by /matches and both
// schedule lists rather than re-deriving the rule per page.
export function buildAttendeeCounts(
  rows: { match_id: string; is_playing: boolean }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.is_playing) continue;
    counts.set(row.match_id, (counts.get(row.match_id) ?? 0) + 1);
  }
  return counts;
}

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
  // EVERY fee is canonical: recomputed here from the costs and who
  // attended, never taken from the client. The wizard shows the same
  // numbers because it renders this engine's output from /preview, but
  // what gets stored is computed on this side of the wire.
  const canonical = calculateMatchFees({
    groundFee: body.ground_fee,
    ballFee: body.ball_fee,
    otherFee: body.other_fee,
    carAllowancePerCar: body.car_allowance_per_car,
    attendees: body.rows.map((r) => ({
      playerId: r.player_id,
      broughtCar: r.brought_car,
      sharedCar: r.shared_car,
    })),
    guests: body.guests.map((g) => ({
      name: g.name,
      broughtCar: g.brought_car,
      sharedCar: g.shared_car,
    })),
    carSplit: "sharers",
  });
  const guestFee = canonical.captainCharge;
  // player_id -> the fee this engine says they owe
  const feeByPlayer = new Map(canonical.rows.map((r) => [r.playerId, r.fee]));

  const collected = canonical.collectedTotal;
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
              other_fee_entry_id, fee_direction, fee_pending, team_id
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
    // Scheduled → completed only: the opponent must be known and a
    // pending fee must be cleared first.
    if (match.status === "scheduled" && !match.opponent?.trim()) {
      throw new ApiError(
        409,
        "OPPONENT_TBD",
        "Set the opponent before completing this match",
      );
    }
    // Same gate for both sources — a legacy booking's amount_pending and
    // a match's own fee_pending (migration 36).
    if (match.status === "scheduled" && Number(match.fee_pending) > 0) {
      throw new ApiError(
        409,
        "PENDING_FEE",
        "Clear the pending match fee before completing this match",
      );
    }
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
           guest_shared_cars = $9,
           updated_by = $10, updated_at = NOW()
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
        body.guests.map((g) => g.shared_car),
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
      const fee = feeByPlayer.get(row.player_id) ?? 0;
      await client.query(
        `INSERT INTO match_participants
           (match_id, player_id, brought_car, shared_car, fee_amount,
            guest_fee_share, is_playing, team_id)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)`,
        [matchId, row.player_id, row.brought_car,
         row.shared_car && !row.brought_car, fee + share, share,
         match.team_id],
      );
    }
    // Captain absent but charged: a charge-only row keeps balances and
    // statements derived from one place.
    if (captain && !captainPlaying && guestFee !== 0) {
      await client.query(
        `INSERT INTO match_participants
           (match_id, player_id, brought_car, shared_car, fee_amount,
            guest_fee_share, is_playing, team_id)
         VALUES ($1, $2, FALSE, FALSE, $3, $3, FALSE, $4)`,
        [matchId, captain.id, guestFee, match.team_id],
      );
    }

    // The pool fronted a DEBIT fee at scheduling, so completion recoups
    // it from the players' collected fees ON TOP of the usual roundoff
    // surplus — pool nets to +surplus over the match's life. A CREDIT
    // fee was never fronted; recouping it would credit the pool twice
    // for the same money, so the direction gates this block. Read the
    // entry's CURRENT amount (admins may have edited it in the ledger);
    // a hand-deleted entry NULLs the link and recoups nothing.
    let recouped = 0;
    if (match.other_fee_entry_id && match.fee_direction !== "credit") {
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
            ? `Match collection vs ${opponentLabel(match.opponent)}`
            : `Match surplus vs ${opponentLabel(match.opponent)}`,
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

// Clearing a match's own pending fee (migration 36). The counterpart of
// lib/bookings.ts clearBookingPending, for matches that carry the fee
// themselves rather than through a ground booking.
//
// One-way by design: the outstanding slice is posted to the pool in the
// SAME direction as the fee it belongs to — a debit we still owed is
// paid out, a credit still owed to us comes in — and fee_pending drops
// to zero, which unlocks completion and turns the card's dot green.
//
// The caller echoes the amount it displayed (expectedPending), so a
// stale page gets 409 PENDING_MISMATCH rather than clearing a different
// figure. FOR UPDATE serializes two admins clearing at once.
export async function clearMatchPending(
  client: PoolClient,
  adminId: string,
  matchId: string,
  expectedPending: number,
) {
  const cur = await client.query(
    `SELECT opponent, venue, fee_direction, fee_pending, team_id
     FROM matches WHERE id = $1 FOR UPDATE`,
    [matchId],
  );
  const match = cur.rows[0];
  if (!match) {
    throw new ApiError(404, "NOT_FOUND", "Match not found");
  }
  const pending = Number(match.fee_pending);
  if (pending <= 0) {
    throw new ApiError(409, "NOTHING_PENDING", "This match has no pending fee");
  }
  if (pending !== expectedPending) {
    throw new ApiError(
      409,
      "PENDING_MISMATCH",
      `The pending amount is now ₹${pending} — reload and try again`,
    );
  }

  const isDebit = match.fee_direction === "debit";
  const message =
    `Match fee (pending cleared) — vs ${opponentLabel(match.opponent)}` +
    (match.venue ? ` at ${match.venue}` : "");
  const entryRes = await client.query(
    `INSERT INTO pool_entries (kind, message, amount, created_by, team_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      isDebit ? "plain_debit" : "other_income",
      message,
      isDebit ? -pending : pending,
      adminId,
      match.team_id,
    ],
  );

  await client.query(`UPDATE matches SET fee_pending = 0 WHERE id = $1`, [
    matchId,
  ]);

  return { cleared: pending, entry_id: entryRes.rows[0].id };
}
