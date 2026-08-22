import { ceilRupees } from "./split";

// Tournament per-match fee model (V3, Ravi 2026-08-17): the team pays
// ONE joining fee for the whole tournament, split equally across the
// matches that actually got completed — costPerMatch = joiningFee / N,
// kept FRACTIONAL (never pre-rounded). Each match's slice is divided
// across that match's attendees, so a thin roster pays more per head.
// Canonical: fee 15000, N 5 → 3000/match; 12 players → CEIL(3000/12) =
// 250; 11 players → CEIL(3000/11) = 273.
//
// Car money follows the team rule (migration-34 / engine/calc.ts): the
// cars × allowance pool is funded only by the people who SHARED a ride,
// split CEIL(carPool / sharers) on top of their base share, and each
// driver gets that match's allowance off their total (may go negative).
// A driver is never a sharer. When nobody shared, no car money is
// collected and no rebate is paid — otherwise the rebate would quietly
// drain the fund.
//
// Both shares CEIL and are the only rounding sites, so per match
// Σ shares ≥ costPerMatch + carPool ≥ costPerMatch + Σ driver credits;
// summing over matches gives collected ≥ joiningFee and surplus is never
// negative.

export type TournamentFeeAttendee = {
  playerId: string;
  broughtCar: boolean;
  sharedCar?: boolean; // rode with someone; ignored for drivers
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
  share: number; // base share, plus the car share if they rode
  driverCredit: number; // that match's allowance if they drove (and someone shared), else 0
};

export type TournamentFeeMatchBreakdown = {
  matchId: string;
  attendeeCount: number;
  cars: number;
  sharers: number;
  share: number; // base share per head: CEIL(costPerMatch / attendees)
  carSharePerSharer: number; // 0 when nobody shared
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
    const isSharer = (a: TournamentFeeAttendee) =>
      !!a.sharedCar && !a.broughtCar;
    const cars = match.attendees.filter((a) => a.broughtCar).length;
    const sharers = match.attendees.filter(isSharer).length;
    const payCars = sharers > 0;
    const carPool = payCars ? cars * match.carAllowancePerCar : 0;
    const share = ceilRupees(costPerMatch / match.attendees.length);
    const carSharePerSharer = payCars ? ceilRupees(carPool / sharers) : 0;
    matches.push({
      matchId: match.matchId,
      attendeeCount: match.attendees.length,
      cars,
      sharers,
      share,
      carSharePerSharer,
    });

    for (const attendee of match.attendees) {
      const driverCredit =
        attendee.broughtCar && payCars ? match.carAllowancePerCar : 0;
      const lineShare = share + (isSharer(attendee) ? carSharePerSharer : 0);
      lines.push({
        playerId: attendee.playerId,
        matchId: match.matchId,
        share: lineShare,
        driverCredit,
      });
      const entry = byPlayer.get(attendee.playerId) ?? {
        played: 0,
        shareSum: 0,
        driverCredit: 0,
      };
      entry.played += 1;
      entry.shareSum += lineShare;
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
