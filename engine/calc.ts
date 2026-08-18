import { ceilRupees } from "./split";

// v2 guest rule: guests count in the split. Per-head = ceil(pot /
// (players + guests)); guest cars join the pot exactly like player
// cars. Each guest's charge (per-head minus their car allowance) is
// deducted from the standing captain's balance — guests hand the
// captain cash offline. The captain is charged even when not playing.
export type Attendee = {
  playerId: string;
  broughtCar: boolean;
};

export type Guest = {
  name: string;
  broughtCar: boolean;
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
  fee: number; // negative = net credit to a driver
};

export type GuestFeeRow = {
  name: string;
  broughtCar: boolean;
  fee: number; // negative = net credit (guest drove), reduces captain charge
};

export type MatchFeeResult = {
  totalCost: number;
  rawShare: number;
  perPlayerFee: number;
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

  const cars =
    input.attendees.filter((a) => a.broughtCar).length +
    guests.filter((g) => g.broughtCar).length;
  const totalCost =
    input.groundFee +
    input.ballFee +
    input.otherFee +
    cars * input.carAllowancePerCar;

  const rawShare = totalCost / headCount;
  const perPlayerFee = ceilRupees(rawShare);

  const rows: FeeRow[] = input.attendees.map((a) => ({
    playerId: a.playerId,
    broughtCar: a.broughtCar,
    fee: a.broughtCar
      ? perPlayerFee - input.carAllowancePerCar // may be negative
      : perPlayerFee,
  }));

  const guestRows: GuestFeeRow[] = guests.map((g) => ({
    name: g.name,
    broughtCar: g.broughtCar,
    fee: g.broughtCar
      ? perPlayerFee - input.carAllowancePerCar
      : perPlayerFee,
  }));
  const captainCharge = guestRows.reduce((sum, g) => sum + g.fee, 0);

  return {
    totalCost,
    rawShare,
    perPlayerFee,
    rows,
    guestRows,
    captainCharge,
    collectedTotal: rows.reduce((sum, r) => sum + r.fee, 0) + captainCharge,
    surplusToPool: perPlayerFee * headCount - totalCost,
  };
}
