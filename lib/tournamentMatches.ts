import { withTransaction } from "@/lib/db";
import { ApiError } from "@/lib/validate";
import { lockTournament } from "@/lib/tournaments";
import type { z } from "zod";
import type {
  tournamentMatchSubmitSchema,
  tournamentScheduleMatchSchema,
} from "@/lib/validate";

type ScheduleBody = z.infer<typeof tournamentScheduleMatchSchema>;
type SubmitBody = z.infer<typeof tournamentMatchSubmitSchema>;

// The SG match engine (lib/matches.ts) scoped to a tournament's
// isolated roster and ledger. Differences from SG, all deliberate:
// - NO guests (teams declare players publicly) — no captain charge,
//   no charge-only rows, calculateMatchFees runs with guests [].
// - No bookings, no pool-fronted ground fees — credit = surplus only.
// - Every write passes lockTournament (completed tournament → 409).
// - Every query is scoped by tournament_id (composite FKs backstop).

export async function scheduleMatch(
  adminId: string,
  tournamentId: string,
  body: ScheduleBody,
) {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);
    const res = await client.query(
      `INSERT INTO tournament_matches
         (tournament_id, match_date, match_time, opponent, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, opponent, match_date, match_time`,
      [tournamentId, body.match_date, body.match_time, body.opponent, adminId],
    );
    return res.rows[0];
  });
}

export async function editSchedule(
  adminId: string,
  tournamentId: string,
  matchId: string,
  body: ScheduleBody,
) {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);
    const res = await client.query(
      `UPDATE tournament_matches
       SET match_date = $3, match_time = $4, opponent = $5,
           updated_by = $6, updated_at = NOW()
       WHERE id = $1 AND tournament_id = $2 AND status = 'scheduled'
       RETURNING id`,
      [
        matchId,
        tournamentId,
        body.match_date,
        body.match_time,
        body.opponent,
        adminId,
      ],
    );
    if (res.rowCount === 0) {
      const probe = await client.query(
        `SELECT status FROM tournament_matches
         WHERE id = $1 AND tournament_id = $2`,
        [matchId, tournamentId],
      );
      if (!probe.rows[0]) {
        throw new ApiError(404, "NOT_FOUND", "Match not found");
      }
      throw new ApiError(
        409,
        "NOT_SCHEDULED",
        "Only scheduled matches can be rescheduled",
      );
    }
    return res.rows[0];
  });
}

// Complete OR edit — identical semantics. ATTENDANCE ONLY (Ravi
// 2026-08-16): the participation-fee model settles all money when the
// TOURNAMENT is marked completed, so match completion just records who
// played, the match's car fee, and who drove. fee_amount is always 0.
export async function completeTournamentMatch(
  tournamentId: string,
  matchId: string,
  adminId: string,
  body: SubmitBody,
): Promise<{
  collected: 0;
  surplus: 0;
  recouped: 0;
  credited: 0;
  guestFee: 0;
  captainName: null;
  players: number;
}> {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);

    const matchRes = await client.query(
      `SELECT id, status, opponent, match_date FROM tournament_matches
       WHERE id = $1 AND tournament_id = $2`,
      [matchId, tournamentId],
    );
    const match = matchRes.rows[0];
    if (!match) {
      throw new ApiError(404, "NOT_FOUND", "Match not found");
    }
    if (match.status === "abandoned") {
      throw new ApiError(409, "ABANDONED", "An abandoned match has no fees");
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
      `SELECT id FROM tournament_players
       WHERE id = ANY($1::uuid[]) AND tournament_id = $2 AND is_active`,
      [uniqueIds, tournamentId],
    );
    if (activeRes.rowCount !== uniqueIds.length) {
      throw new ApiError(
        422,
        "INACTIVE_PLAYER",
        "Every attendee must be an active player of this tournament",
      );
    }

    // Fixed order: match update -> participants replace -> collection upsert.
    await client.query(
      `UPDATE tournament_matches
       SET status = 'completed', result = $2,
           ground_fee = $3, ball_fee = $4, other_fee = $5,
           car_allowance_per_car = $6, updated_by = $7, updated_at = NOW()
       WHERE id = $1`,
      [
        matchId,
        body.result,
        body.ground_fee,
        body.ball_fee,
        body.other_fee,
        body.car_allowance_per_car,
        adminId,
      ],
    );

    await client.query(
      `DELETE FROM tournament_match_participants WHERE match_id = $1`,
      [matchId],
    );
    // One multi-row insert. shared_car is stored as the EFFECTIVE flag:
    // a driver always funds the car pot (engine/tournamentFee.ts).
    await client.query(
      `INSERT INTO tournament_match_participants
         (tournament_id, match_id, player_id, brought_car, shared_car, fee_amount)
       SELECT $1, $2, u.player_id, u.brought_car, u.shared_car, 0
         FROM unnest($3::uuid[], $4::boolean[], $5::boolean[])
           AS u(player_id, brought_car, shared_car)`,
      [
        tournamentId,
        matchId,
        body.rows.map((r) => r.player_id),
        body.rows.map((r) => r.brought_car),
        body.rows.map((r) => r.shared_car || r.brought_car),
      ],
    );
    // Legacy cleanup: editing a match completed under the old per-match
    // model removes its stale surplus row.
    await client.query(`DELETE FROM tournament_entries WHERE match_id = $1`, [
      matchId,
    ]);

    return {
      collected: 0,
      surplus: 0,
      recouped: 0,
      credited: 0,
      guestFee: 0,
      captainName: null,
      players: body.rows.length,
    };
  });
}

export async function abandonTournamentMatch(
  adminId: string,
  tournamentId: string,
  matchId: string,
  reason: string,
) {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);
    const res = await client.query(
      `UPDATE tournament_matches
       SET status = 'abandoned', abandoned_reason = $3,
           updated_by = $4, updated_at = NOW()
       WHERE id = $1 AND tournament_id = $2 AND status = 'scheduled'
       RETURNING id, status`,
      [matchId, tournamentId, reason, adminId],
    );
    if (res.rowCount === 0) {
      throw new ApiError(
        409,
        "NOT_SCHEDULED",
        "Only scheduled matches can be abandoned",
      );
    }
    return { ...res.rows[0], fee_reverted: 0 };
  });
}

// Superadmin-checked in the route. FK cascades remove the participants
// and the match_collection entry — balances and the fund re-derive.
// A completed tournament must be reopened first (read-only invariant).
export async function deleteTournamentMatch(
  tournamentId: string,
  matchId: string,
) {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);
    const res = await client.query(
      `DELETE FROM tournament_matches
       WHERE id = $1 AND tournament_id = $2
       RETURNING id`,
      [matchId, tournamentId],
    );
    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Match not found");
    }
    return { id: matchId };
  });
}
