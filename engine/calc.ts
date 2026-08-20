import { ceilRupees } from "./split";

// v2 guest rule: guests count in the split. Per-head = ceil(pot /
// (players + guests)); guest cars join the pot exactly like player
// cars. Each guest's charge (per-head minus their car allowance) is
// deducted from the standing captain's balance — guests hand the
// captain cash offline. The captain is charged even when not playing.
//
// v3 car sharing: WHO pays for the cars is now a choice, made by the
// caller, not inferred from the data:
//
//   "everyone" — the original rule. Car money joins one pot and every
//                head funds it, drivers included. Tournaments and any
//                caller that never collects sharing keep this.
//   "sharers"  — only the people who rode with someone fund the cars.
//                Someone who made their own way stops paying for other
//                people's cars.
//
// The mode is explicit at the call site on purpose. Inferring it from
// "did anyone tick shared?" would silently apply the sharers rule to a
// flow that never asks the question — the tournament preview calls this
// same function — and quietly delete every driver's rebate there.
export type CarSplit = "everyone" | "sharers";

export type Attendee = {
  playerId: string;
  broughtCar: boolean;
  sharedCar?: boolean; // rode with someone; ignored when carSplit is "everyone"
};

export type Guest = {
  name: string;
  broughtCar: boolean;
  sharedCar?: boolean;
};

export type MatchFeeInput = {
  groundFee: number;
  ballFee: number;
  otherFee: number;
  carAllowancePerCar: number;
  attendees: Attendee[];
  guests?: Guest[];
  carSplit?: CarSplit; // default "everyone" — the pre-sharing behaviour
};

export type FeeRow = {
  playerId: string;
  broughtCar: boolean;
  sharedCar: boolean;
  fee: number; // negative = net credit to a driver
};

export type GuestFeeRow = {
  name: string;
  broughtCar: boolean;
  sharedCar: boolean;
  fee: number; // negative = net credit (guest drove), reduces captain charge
};

export type MatchFeeResult = {
  totalCost: number;
  rawShare: number;
  perPlayerFee: number; // the base head share; under "sharers" a sharer pays more
  carSharePerSharer: number; // 0 under "everyone", or when nobody shared
  sharerCount: number;
  rows: FeeRow[];
  guestRows: GuestFeeRow[];
  captainCharge: number; // sum of guest fees, lands on the captain
  collectedTotal: number; // player rows + captain charge
  surplusToPool: number; // always >= 0 (ceil rounding remainder)
};

export function calculateMatchFees(input: MatchFeeInput): MatchFeeResult {
  const guests = input.guests ?? [];
  const playerCount = input.attendees.length;
  if (playerCount === 0) {
    throw new Error("NO_PLAYERS");
  }
  const headCount = playerCount + guests.length;
  const carSplit: CarSplit = input.carSplit ?? "everyone";
  const allowance = input.carAllowancePerCar;
  const baseCost = input.groundFee + input.ballFee + input.otherFee;

  const cars =
    input.attendees.filter((a) => a.broughtCar).length +
    guests.filter((g) => g.broughtCar).length;

  // A driver is never a sharer: they provided the car, they do not pay
  // toward it. Ticking both means the same thing as ticking "brought".
  const sharerCount =
    carSplit === "sharers"
      ? input.attendees.filter((a) => a.sharedCar && !a.broughtCar).length +
        guests.filter((g) => g.sharedCar && !g.broughtCar).length
      : 0;

  // Nobody shared a ride, so there is nothing for the allowance to
  // compensate: no car money is collected and no rebate is paid. Leaving
  // the rebate in with no one funding it would quietly drain the pool.
  const payCars = carSplit === "everyone" || sharerCount > 0;
  const carPool = payCars ? cars * allowance : 0;
  const totalCost = baseCost + carPool;

  // "everyone": one pot, one share, exactly as before — the car money is
  // inside baseShare. "sharers": the base is split across all heads and
  // the car money only across the people who rode.
  const rawShare =
    carSplit === "everyone" ? totalCost / headCount : baseCost / headCount;
  const perPlayerFee = ceilRupees(rawShare);
  const carSharePerSharer =
    carSplit === "sharers" && sharerCount > 0
      ? ceilRupees(carPool / sharerCount)
      : 0;

  const feeFor = (broughtCar: boolean, sharedCar: boolean) => {
    const isSharer = carSplit === "sharers" && sharedCar && !broughtCar;
    const rebate = broughtCar && payCars ? allowance : 0;
    return perPlayerFee + (isSharer ? carSharePerSharer : 0) - rebate;
  };

  const rows: FeeRow[] = input.attendees.map((a) => ({
    playerId: a.playerId,
    broughtCar: a.broughtCar,
    sharedCar: !!a.sharedCar && !a.broughtCar,
    fee: feeFor(a.broughtCar, !!a.sharedCar),
  }));

  const guestRows: GuestFeeRow[] = guests.map((g) => ({
    name: g.name,
    broughtCar: g.broughtCar,
    sharedCar: !!g.sharedCar && !g.broughtCar,
    fee: feeFor(g.broughtCar, !!g.sharedCar),
  }));
  const captainCharge = guestRows.reduce((sum, g) => sum + g.fee, 0);

  const collectedTotal =
    rows.reduce((sum, r) => sum + r.fee, 0) + captainCharge;

  return {
    totalCost,
    rawShare,
    perPlayerFee,
    carSharePerSharer,
    sharerCount,
    rows,
    guestRows,
    captainCharge,
    collectedTotal,
    // What the pool actually keeps: everything collected, less the cash
    // the team spent. Drivers keep their allowance, so it is not a cost
    // the pool has to recover. Identical to the old
    // `perPlayerFee * headCount - totalCost` under "everyone", and still
    // >= 0 under "sharers" because ceil makes sharers cover the car pot.
    surplusToPool: collectedTotal - baseCost,
  };
}
