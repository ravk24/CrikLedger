import { ceilRupees } from "./split";

// Tournament per-match fee model (V3, Ravi 2026-08-17): the team pays
// ONE joining fee for the whole tournament, split equally across the
// matches that actually got completed — costPerMatch = joiningFee / N,
// kept FRACTIONAL (never pre-rounded). Each match is then its own pot:
// matchPot = costPerMatch + cars × that match's allowance, divided
// across that match's attendees, so a thin roster pays more per head.
// Canonical: fee 15000, N 5 → 3000/match; 12 players + 2 cars @250 →
// CEIL(3500/12) = 292; 11 players, cars ignored → CEIL(3000/11) = 273.
// Drivers get that match's allowance off their total (may go negative).
//
// The per-match share is the ONLY rounding site and it CEILs, so
// share × attendees ≥ matchPot per match; summing over matches gives
// collected ≥ joiningFee and surplus is never negative.

export type TournamentFeeAttendee = {
  playerId: string;
  broughtCar: boolean;
};

export type TournamentFeeMatch = {
  matchId: string;
  carAllowancePerCar: number;
  attendees: TournamentFeeAttendee[];
};

export type TournamentFeeInput = {
  joiningFee: number;
  matches: TournamentFeeMatch[];
};

// One row per (player, match) — persisted so the statement drill-down
// can show the true per-match amounts (each match has its own rate).
export type TournamentFeeLine = {
  playerId: string;
  matchId: string;
  share: number; // ceilRupees(matchPot / attendeeCount)
  driverCredit: number; // that match's allowance if they drove, else 0
};

export type TournamentFeeMatchBreakdown = {
  matchId: string;
  attendeeCount: number;
  cars: number;
  share: number;
};

export type TournamentFeeRow = {
  playerId: string;
  played: number;
  driverCredit: number;
  charge: number; // Σ shares − Σ driver credits; may be negative
};

export type TournamentFeeResult = {
  matchCount: number;
  costPerMatch: number; // joiningFee / matchCount — fractional
  matches: TournamentFeeMatchBreakdown[];
  lines: TournamentFeeLine[];
  rows: TournamentFeeRow[]; // only players who played at least once
  collected: number;
  surplus: number; // collected − joiningFee (the ceil excess), ≥ 0
};

export function calculateTournamentFees(
  input: TournamentFeeInput,
): TournamentFeeResult {
  const matchCount = input.matches.length;
  if (matchCount === 0) throw new Error("NO_COMPLETED_MATCHES");
  for (const match of input.matches) {
    if (match.attendees.length === 0) throw new Error("EMPTY_MATCH_ATTENDEES");
  }

  const costPerMatch = input.joiningFee / matchCount;

  const matches: TournamentFeeMatchBreakdown[] = [];
  const lines: TournamentFeeLine[] = [];
  const byPlayer = new Map<
    string,
    { played: number; shareSum: number; driverCredit: number }
  >();

  for (const match of input.matches) {
    const cars = match.attendees.filter((a) => a.broughtCar).length;
    const matchPot = costPerMatch + cars * match.carAllowancePerCar;
    const share = ceilRupees(matchPot / match.attendees.length);
    matches.push({
      matchId: match.matchId,
      attendeeCount: match.attendees.length,
      cars,
      share,
    });

    for (const attendee of match.attendees) {
      const driverCredit = attendee.broughtCar ? match.carAllowancePerCar : 0;
      lines.push({
        playerId: attendee.playerId,
        matchId: match.matchId,
        share,
        driverCredit,
      });
      const entry = byPlayer.get(attendee.playerId) ?? {
        played: 0,
        shareSum: 0,
        driverCredit: 0,
      };
      entry.played += 1;
      entry.shareSum += share;
      entry.driverCredit += driverCredit;
      byPlayer.set(attendee.playerId, entry);
    }
  }

  const rows: TournamentFeeRow[] = [...byPlayer.entries()].map(
    ([playerId, { played, shareSum, driverCredit }]) => ({
      playerId,
      played,
      driverCredit,
      charge: shareSum - driverCredit,
    }),
  );

  const collected = rows.reduce((sum, r) => sum + r.charge, 0);
  return {
    matchCount,
    costPerMatch,
    matches,
    lines,
    rows,
    collected,
    surplus: collected - input.joiningFee,
  };
}
