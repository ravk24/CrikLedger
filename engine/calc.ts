import { ceilRupees } from "./split";

// THE match fee rule (Ravi, locked 2026-08-25). One model, no options.
//
//   H          = players + guests            (guests are heads; their
//                                             fees land on the captain)
//   base       = ground + balls + other
//   C          = cars brought (players + guests)
//   A          = allowance per car
//   S          = heads with (sharedCar OR broughtCar)
//                — A DRIVER IS ALWAYS A SHARER, so S >= C
//   baseShare  = CEIL(base / H)
//   carShare   = S > 0 ? CEIL(C × A / S) : 0
//                — ONE pooled pot split evenly across every sharer,
//                  never per car (500 across 9 people, not 250/5 + 250/4)
//   fee(rider)   = baseShare + carShare
//   fee(own way) = baseShare
//   fee(driver)  = baseShare + carShare − A   (may be negative: the team
//                                              owes them, shown "gets ₹x")
//   totalCost    = base + C × A                (what the sheet prints)
//   surplusToPool = collected − base
//                 = (H·baseShare − base) + (S·carShare − C·A)  ≥ 0
//
// Canonical: ground 2500 + balls 60, A 250, 11 players (3 drivers) +
// 2 guests, everyone shared → base 197, car CEIL(750/13) = 58, riders
// 255, drivers 5, surplus 5. Same with the guests unticked → S 11, car
// 69, riders 266, drivers 16, guests 197, surplus 10.
//
// Rounding happens here and nowhere else (engine/split.ts ceilRupees).
// Two separate ceils are canonical; they can exceed CEIL((base+cars)/H)
// by a rupee when everyone shares, and that is the agreed behaviour.
//
// History: 2026-08-20 to 2026-08-25 the engine excluded drivers from
// the sharers ("a driver never funds cars") and paid no rebate when
// nobody ticked shared. That was wrong. Do not reinstate it.

export type Attendee = {
  playerId: string;
  broughtCar: boolean;
  sharedCar?: boolean; // rode in a car; drivers count as sharers regardless
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
};

export type FeeRow = {
  playerId: string;
  broughtCar: boolean;
  sharedCar: boolean; // effective: funded the car pot (always true for drivers)
  fee: number; // negative = net credit to a driver
};

export type GuestFeeRow = {
  name: string;
  broughtCar: boolean;
  sharedCar: boolean;
  fee: number; // negative = net credit (guest drove), reduces captain charge
};

export type MatchFeeResult = {
  totalCost: number; // base + cars × allowance
  cashCosts: number; // base: ground + balls + other
  headCount: number;
  carCount: number;
  perPlayerFee: number; // baseShare = CEIL(base / heads)
  carSharePerSharer: number; // CEIL(carPool / sharers), 0 with no cars
  sharerCount: number; // drivers included
  ownWayCount: number; // heads − sharers
  rows: FeeRow[];
  guestRows: GuestFeeRow[];
  captainCharge: number; // sum of guest fees, lands on the captain
  collectedTotal: number; // player rows + captain charge
  surplusToPool: number; // always >= 0 (ceil remainders)
};

const isSharer = (x: { broughtCar: boolean; sharedCar?: boolean }) =>
  x.broughtCar || !!x.sharedCar;

export function calculateMatchFees(input: MatchFeeInput): MatchFeeResult {
  const guests = input.guests ?? [];
  const playerCount = input.attendees.length;
  if (playerCount === 0) {
    throw new Error("NO_PLAYERS");
  }
  const headCount = playerCount + guests.length;
  const allowance = input.carAllowancePerCar;
  const cashCosts = input.groundFee + input.ballFee + input.otherFee;

  const heads = [...input.attendees, ...guests];
  const carCount = heads.filter((h) => h.broughtCar).length;
  const sharerCount = heads.filter(isSharer).length;
  const carPool = carCount * allowance;
  const totalCost = cashCosts + carPool;

  const perPlayerFee = ceilRupees(cashCosts / headCount);
  const carSharePerSharer =
    carPool > 0 && sharerCount > 0 ? ceilRupees(carPool / sharerCount) : 0;

  const feeFor = (h: { broughtCar: boolean; sharedCar?: boolean }) =>
    perPlayerFee +
    (isSharer(h) ? carSharePerSharer : 0) -
    (h.broughtCar ? allowance : 0);

  const rows: FeeRow[] = input.attendees.map((a) => ({
    playerId: a.playerId,
    broughtCar: a.broughtCar,
    sharedCar: isSharer(a),
    fee: feeFor(a),
  }));

  const guestRows: GuestFeeRow[] = guests.map((g) => ({
    name: g.name,
    broughtCar: g.broughtCar,
    sharedCar: isSharer(g),
    fee: feeFor(g),
  }));
  const captainCharge = guestRows.reduce((sum, g) => sum + g.fee, 0);

  const collectedTotal =
    rows.reduce((sum, r) => sum + r.fee, 0) + captainCharge;

  return {
    totalCost,
    cashCosts,
    headCount,
    carCount,
    perPlayerFee,
    carSharePerSharer,
    sharerCount,
    ownWayCount: headCount - sharerCount,
    rows,
    guestRows,
    captainCharge,
    collectedTotal,
    // Drivers keep their allowance, so the pool only has to recover the
    // cash it spent; every ceil remainder lands here.
    surplusToPool: collectedTotal - cashCosts,
  };
}
