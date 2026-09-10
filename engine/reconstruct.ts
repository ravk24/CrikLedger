import { calculateMatchFees, type MatchFeeResult } from "./calc";
import { ceilRupees } from "./split";

// A completed match's figures, read back from what completeMatch stored
// (lib/matches.ts) instead of re-running the engine on the inputs.
//
// Why: the rounding rule changed on 2026-09-10 (one ceiling per head
// instead of one per part). Matches completed before that keep the fee
// rows they were charged, so a match page must print Per head, Collected
// and Surplus that agree with its own FeeTable — whichever rule wrote it.
//
// What is stored per participant: fee_amount (their own fee, plus the
// guest money on the captain's row) and guest_fee_share (that guest
// slice). A charge-only captain row has is_playing = false. Guests are
// stored on the match as names + brought_car + shared_car arrays; their
// per-guest fee is not stored, so it is rebuilt from the sharer fee.

export type StoredParticipant = {
  name: string;
  isPlaying: boolean;
  broughtCar: boolean;
  sharedCar: boolean; // effective flag as stored: shared OR brought
  feeAmount: number;
  guestFeeShare: number;
};

export type StoredGuest = {
  name: string;
  broughtCar: boolean;
  sharedCar: boolean;
};

export type StoredMatchInput = {
  groundFee: number;
  ballFee: number;
  otherFee: number;
  carAllowancePerCar: number;
  participants: StoredParticipant[];
  guests: StoredGuest[];
};

const isSharer = (x: { broughtCar: boolean; sharedCar: boolean }) =>
  x.broughtCar || x.sharedCar;

export function reconstructMatchFees(input: StoredMatchInput): MatchFeeResult {
  const playing = input.participants.filter((p) => p.isPlaying);
  if (playing.length === 0) {
    throw new Error("NO_PLAYERS");
  }
  const allowance = input.carAllowancePerCar;
  const cashCosts = input.groundFee + input.ballFee + input.otherFee;
  const headCount = playing.length + input.guests.length;
  const heads = [...playing, ...input.guests];
  const carCount = heads.filter((h) => h.broughtCar).length;
  const sharerCount = heads.filter(isSharer).length;
  const carPool = carCount * allowance;

  // The base share formula never changed, so own-way fees are exact.
  const perPlayerFee = ceilRupees(cashCosts / headCount);

  const rows = playing.map((p) => ({
    playerId: p.name,
    broughtCar: p.broughtCar,
    sharedCar: isSharer(p),
    fee: p.feeAmount - p.guestFeeShare,
  }));

  // Every sharer was charged the same sharer fee (drivers minus the
  // allowance), so any stored sharer row gives it back. Only when the
  // pot was funded by guests alone is there no such row; then the
  // engine's answer is the best available.
  const sharerRows = rows.filter((r) => r.sharedCar);
  const sharerFee =
    sharerRows.length > 0
      ? Math.max(...sharerRows.map((r) => r.fee + (r.broughtCar ? allowance : 0)))
      : (() => {
          const calc = calculateMatchFees({
            groundFee: input.groundFee,
            ballFee: input.ballFee,
            otherFee: input.otherFee,
            carAllowancePerCar: allowance,
            attendees: playing.map((p) => ({
              playerId: p.name,
              broughtCar: p.broughtCar,
              sharedCar: p.sharedCar,
            })),
            guests: input.guests,
          });
          return calc.perPlayerFee + calc.carSharePerSharer;
        })();

  const guestRows = input.guests.map((g) => ({
    name: g.name,
    broughtCar: g.broughtCar,
    sharedCar: isSharer(g),
    fee: isSharer(g)
      ? sharerFee - (g.broughtCar ? allowance : 0)
      : perPlayerFee,
  }));

  const captainCharge = input.participants.reduce(
    (sum, p) => sum + p.guestFeeShare,
    0,
  );
  const collectedTotal = input.participants.reduce(
    (sum, p) => sum + p.feeAmount,
    0,
  );

  return {
    totalCost: cashCosts + carPool,
    cashCosts,
    headCount,
    carCount,
    perPlayerFee,
    carSharePerSharer: sharerFee - perPlayerFee,
    sharerCount,
    ownWayCount: headCount - sharerCount,
    rows,
    guestRows,
    captainCharge,
    collectedTotal,
    surplusToPool: collectedTotal - cashCosts,
  };
}
