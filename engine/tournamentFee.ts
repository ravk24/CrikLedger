import { ceilRupees } from "./split";

// Tournament per-match fee model (V3, Ravi 2026-08-17): the team pays
// ONE joining fee for the whole tournament, split equally across the
// matches that actually got completed — costPerMatch = joiningFee / N,
// kept FRACTIONAL (never pre-rounded). Each match's slice is divided
// across that match's attendees, so a thin roster pays more per head.
// Canonical: fee 15000, N 5 → 3000/match; 12 players → CEIL(3000/12) =
// 250; 11 players → CEIL(3000/11) = 273.
//
// Car money follows THE team rule (engine/calc.ts, locked 2026-08-25,
// rounding revised 2026-09-10): that match's cars × allowance is one
// pooled pot shared across everyone who rode in a car — DRIVERS
// INCLUDED — and a sharer pays ONE ceiling over base + pot share,
// CEIL(costPerMatch / attendees + pool / sharers), never a ceiling per
// part. Each driver gets the allowance off their total (may go
// negative). Someone who made their own way pays only the base share
// CEIL(costPerMatch / attendees). A driver who carried nobody is the
// sole sharer of their own car: pays the pool, gets it back, nets the
// base share.
//
// The two ceilings are the only rounding sites and each rounds a head's
// exact share up, so per match Σ shares ≥ costPerMatch + carPool ≥
// costPerMatch + Σ driver credits; summing over matches gives collected
// ≥ joiningFee, surplus is never negative, and a match's surplus stays
// below its head count. (Until 2026-09-10 base and car shares CEILed
// separately, so the two remainders added — same fix as calc.ts.)

export type TournamentFeeAttendee = {
  playerId: string;
  broughtCar: boolean;
  sharedCar?: boolean; // rode in a car; drivers count as sharers regardless
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
  driverCredit: number; // that match's allowance if they drove, else 0
};

export type TournamentFeeMatchBreakdown = {
  matchId: string;
  attendeeCount: number;
  cars: number;
  sharers: number;
  share: number; // base share per head: CEIL(costPerMatch / attendees)
  carSharePerSharer: number; // sharer share − base share; 0 when there are no cars
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
      a.broughtCar || !!a.sharedCar;
    const cars = match.attendees.filter((a) => a.broughtCar).length;
    const sharers = match.attendees.filter(isSharer).length;
    const carPool = cars * match.carAllowancePerCar;
    const attendeeCount = match.attendees.length;
    const share = ceilRupees(costPerMatch / attendeeCount);
    // costPerMatch = joiningFee / matchCount is fractional, so the
    // sharer ceiling is taken over integers: joiningFee/(N·att) +
    // pool/sharers = (joiningFee·sharers + pool·N·att) / (N·att·sharers).
    const sharerShare =
      carPool > 0 && sharers > 0
        ? ceilRupees(
            (input.joiningFee * sharers + carPool * matchCount * attendeeCount) /
              (matchCount * attendeeCount * sharers),
          )
        : share;
    const carSharePerSharer = sharerShare - share;
    matches.push({
      matchId: match.matchId,
      attendeeCount: match.attendees.length,
      cars,
      sharers,
      share,
      carSharePerSharer,
    });

    for (const attendee of match.attendees) {
      const driverCredit = attendee.broughtCar ? match.carAllowancePerCar : 0;
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
