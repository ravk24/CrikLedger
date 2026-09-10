import { describe, expect, it } from "vitest";
import { calculateMatchFees, type Attendee, type Guest } from "./calc";
import { reconstructMatchFees, type StoredParticipant } from "./reconstruct";

const costs = {
  groundFee: 2500,
  ballFee: 60,
  otherFee: 0,
  carAllowancePerCar: 250,
};

// Mirrors what completeMatch stores: every playing row carries its own
// fee, the captain's row also carries the guest money.
function store(
  attendees: Attendee[],
  guests: Guest[],
  captainId: string | null,
  captainPlays = true,
) {
  const calc = calculateMatchFees({ ...costs, attendees, guests });
  const rows: StoredParticipant[] = calc.rows.map((r) => {
    const share = r.playerId === captainId ? calc.captainCharge : 0;
    return {
      name: r.playerId,
      isPlaying: true,
      broughtCar: r.broughtCar,
      sharedCar: r.sharedCar,
      feeAmount: r.fee + share,
      guestFeeShare: share,
    };
  });
  if (captainId && !captainPlays && calc.captainCharge !== 0) {
    rows.push({
      name: captainId,
      isPlaying: false,
      broughtCar: false,
      sharedCar: false,
      feeAmount: calc.captainCharge,
      guestFeeShare: calc.captainCharge,
    });
  }
  return { calc, rows };
}

const people = (n: number, drivers: number, ownWay: number[] = []): Attendee[] =>
  Array.from({ length: n }, (_, i) => ({
    playerId: `p${i + 1}`,
    broughtCar: i < drivers,
    sharedCar: !ownWay.includes(i),
  }));

const storedGuests = (guests: Guest[]) =>
  guests.map((g) => ({
    name: g.name,
    broughtCar: g.broughtCar,
    sharedCar: g.broughtCar || !!g.sharedCar,
  }));

describe("reconstructMatchFees", () => {
  it("reads back exactly what the current engine stored — cars, guests, own way, captain playing", () => {
    const guests: Guest[] = [
      { name: "Guest A", broughtCar: true },
      { name: "Guest B", broughtCar: false, sharedCar: true },
      { name: "Guest C", broughtCar: false, sharedCar: false },
    ];
    const attendees = people(11, 3, [9, 10]);
    const { calc, rows } = store(attendees, guests, "p4");
    const back = reconstructMatchFees({
      ...costs,
      participants: rows,
      guests: storedGuests(guests),
    });
    expect(back).toEqual(calc);
  });

  it("captain absent: the charge-only row counts toward collected, not the fee rows", () => {
    const guests: Guest[] = [{ name: "G", broughtCar: false, sharedCar: true }];
    const attendees = people(10, 2);
    const { calc, rows } = store(attendees, guests, "captain", false);
    const back = reconstructMatchFees({
      ...costs,
      participants: rows,
      guests: storedGuests(guests),
    });
    expect(back.rows).toHaveLength(10);
    expect(back.captainCharge).toBe(calc.captainCharge);
    expect(back.collectedTotal).toBe(calc.collectedTotal);
    expect(back.surplusToPool).toBe(calc.surplusToPool);
    expect(back.guestRows).toEqual(calc.guestRows);
  });

  it("a match completed under the old two-ceiling rule keeps its own numbers: 302 / 52, collected 2572, surplus 12", () => {
    // 2026-08-25 → 2026-09-10 the engine wrote base 233 + car 69.
    const rows: StoredParticipant[] = Array.from({ length: 11 }, (_, i) => ({
      name: `p${i + 1}`,
      isPlaying: true,
      broughtCar: i < 3,
      sharedCar: true,
      feeAmount: i < 3 ? 52 : 302,
      guestFeeShare: 0,
    }));
    const back = reconstructMatchFees({ ...costs, participants: rows, guests: [] });
    expect(back.perPlayerFee).toBe(233);
    expect(back.perPlayerFee + back.carSharePerSharer).toBe(302);
    expect(back.collectedTotal).toBe(2572);
    expect(back.surplusToPool).toBe(12);
    expect(back.totalCost).toBe(3310);
    expect(back.carCount).toBe(3);
    expect(back.sharerCount).toBe(11);
    // The engine itself now says 301 / 1 for the same inputs.
    const fresh = calculateMatchFees({ ...costs, attendees: people(11, 3) });
    expect(fresh.perPlayerFee + fresh.carSharePerSharer).toBe(301);
    expect(fresh.surplusToPool).toBe(1);
  });

  it("old-rule guests are rebuilt from the sharer fee, so they still sum to the captain charge", () => {
    // Old rule, 13 heads all shared: base 197 + car 58 = 255; captain
    // p1 carried the two guests (510).
    const rows: StoredParticipant[] = Array.from({ length: 11 }, (_, i) => ({
      name: `p${i + 1}`,
      isPlaying: true,
      broughtCar: i < 3,
      sharedCar: true,
      feeAmount: (i < 3 ? 5 : 255) + (i === 0 ? 510 : 0),
      guestFeeShare: i === 0 ? 510 : 0,
    }));
    const back = reconstructMatchFees({
      ...costs,
      participants: rows,
      guests: [
        { name: "Abc", broughtCar: false, sharedCar: true },
        { name: "def", broughtCar: false, sharedCar: true },
      ],
    });
    expect(back.rows.find((r) => r.playerId === "p1")?.fee).toBe(5);
    expect(back.guestRows.map((g) => g.fee)).toEqual([255, 255]);
    expect(back.captainCharge).toBe(510);
    expect(back.collectedTotal).toBe(2565);
    expect(back.surplusToPool).toBe(5);
  });

  it("falls back to the engine when only guests funded the pot", () => {
    const guests: Guest[] = [
      { name: "Guest A", broughtCar: true },
      { name: "Guest B", broughtCar: false, sharedCar: true },
    ];
    const attendees = people(5, 0, [0, 1, 2, 3, 4]);
    const { calc, rows } = store(attendees, guests, "p1");
    const back = reconstructMatchFees({
      ...costs,
      participants: rows,
      guests: storedGuests(guests),
    });
    expect(back).toEqual(calc);
  });

  it("rejects a match with no playing rows", () => {
    expect(() =>
      reconstructMatchFees({ ...costs, participants: [], guests: [] }),
    ).toThrow("NO_PLAYERS");
  });
});
