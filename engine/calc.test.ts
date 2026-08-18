import { describe, expect, it } from "vitest";
import { calculateMatchFees, type Attendee } from "./calc";
import { carFee } from "./carFee";
import { ceilSplit } from "./split";
import { virtualFee } from "./virtualFee";

function selfRows(count: number, drivers = 0): Attendee[] {
  return Array.from({ length: count }, (_, i) => ({
    playerId: `p${i + 1}`,
    broughtCar: i < drivers,
  }));
}

describe("calculateMatchFees", () => {
  it("canonical: 2560/12 with 2 cars @250 — fee 214, driver -36, collected 2068, surplus 8", () => {
    const result = calculateMatchFees({
      groundFee: 2000,
      ballFee: 60,
      otherFee: 0,
      carAllowancePerCar: 250,
      attendees: selfRows(12, 2),
    });
    expect(result.totalCost).toBe(2560);
    expect(result.perPlayerFee).toBe(214);
    expect(result.rows.filter((r) => r.broughtCar).map((r) => r.fee)).toEqual([
      -36, -36,
    ]);
    expect(result.rows.filter((r) => !r.broughtCar).every((r) => r.fee === 214)).toBe(true);
    expect(result.collectedTotal).toBe(2068);
    expect(result.surplusToPool).toBe(8);
  });

  it("exact division: 2400/12, 0 cars — fee 200, surplus 0", () => {
    const result = calculateMatchFees({
      groundFee: 2400,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 0,
      attendees: selfRows(12),
    });
    expect(result.perPlayerFee).toBe(200);
    expect(result.collectedTotal).toBe(2400);
    expect(result.surplusToPool).toBe(0);
  });

  it("allowance > fee: negative driver fee handled and preserved", () => {
    // Small match, far ground: 500 ground, 1 car @300, 5 attendees
    // total 800, share 160, driver 160 - 300 = -140
    const result = calculateMatchFees({
      groundFee: 500,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 300,
      attendees: selfRows(5, 1),
    });
    expect(result.perPlayerFee).toBe(160);
    expect(result.rows[0].fee).toBe(-140);
    expect(result.collectedTotal).toBe(4 * 160 - 140);
    expect(result.surplusToPool).toBe(0);
  });

  it("guests join the split (product example): 3600/12 heads — 300 each, captain owes 600", () => {
    // 10 players + 2 guests, pot 3600, no cars. Everyone owes 300;
    // the two guest shares land on the captain.
    const result = calculateMatchFees({
      groundFee: 3600,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 250,
      attendees: selfRows(10),
      guests: [
        { name: "Guest A", broughtCar: false },
        { name: "Guest B", broughtCar: false },
      ],
    });
    expect(result.totalCost).toBe(3600);
    expect(result.perPlayerFee).toBe(300); // ceil(3600 / 12)
    expect(result.rows.every((r) => r.fee === 300)).toBe(true);
    expect(result.guestRows.map((g) => g.fee)).toEqual([300, 300]);
    expect(result.captainCharge).toBe(600);
    expect(result.collectedTotal).toBe(3600);
    expect(result.surplusToPool).toBe(0);
  });

  it("guest with car: allowance joins the pot and rebates that guest's charge", () => {
    // Pot 3350 + 250 guest car = 3600 across 12 heads -> 300 each;
    // the driving guest owes 300 - 250 = 50, captain owes 350.
    const result = calculateMatchFees({
      groundFee: 3350,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 250,
      attendees: selfRows(10),
      guests: [
        { name: "Guest A", broughtCar: true },
        { name: "Guest B", broughtCar: false },
      ],
    });
    expect(result.totalCost).toBe(3600);
    expect(result.perPlayerFee).toBe(300);
    expect(result.guestRows.map((g) => g.fee)).toEqual([50, 300]);
    expect(result.captainCharge).toBe(350);
    expect(result.collectedTotal).toBe(10 * 300 + 350);
    expect(result.surplusToPool).toBe(0);
  });

  it("guest driver can go net-negative, reducing the captain charge", () => {
    // 500 ground + 300 guest car = 800 over 5 heads -> 160 each;
    // the driving guest is -140, so captain owes 160 - 140 = 20.
    const result = calculateMatchFees({
      groundFee: 500,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 300,
      attendees: selfRows(3),
      guests: [
        { name: "Guest A", broughtCar: true },
        { name: "Guest B", broughtCar: false },
      ],
    });
    expect(result.perPlayerFee).toBe(160);
    expect(result.guestRows.map((g) => g.fee)).toEqual([-140, 160]);
    expect(result.captainCharge).toBe(20);
  });

  it("no guests: guestRows empty, captainCharge 0, math unchanged", () => {
    const result = calculateMatchFees({
      groundFee: 2400,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 0,
      attendees: selfRows(12),
    });
    expect(result.guestRows).toEqual([]);
    expect(result.captainCharge).toBe(0);
    expect(result.collectedTotal).toBe(2400);
  });

  it("1 attendee who is also the only driver: fee = ceil(cost) - allowance, no divide-by-zero", () => {
    const result = calculateMatchFees({
      groundFee: 1000,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 250,
      attendees: selfRows(1, 1),
    });
    expect(result.totalCost).toBe(1250);
    expect(result.perPlayerFee).toBe(1250);
    expect(result.rows[0].fee).toBe(1000);
    expect(result.collectedTotal).toBe(1000);
    expect(result.surplusToPool).toBe(0);
  });

  it("all fees 0: every fee 0, surplus 0", () => {
    const result = calculateMatchFees({
      groundFee: 0,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 0,
      attendees: selfRows(11, 2),
    });
    expect(result.rows.every((r) => r.fee === 0)).toBe(true);
    expect(result.collectedTotal).toBe(0);
    expect(result.surplusToPool).toBe(0);
  });

  it("zero attendees is rejected", () => {
    expect(() =>
      calculateMatchFees({
        groundFee: 1000,
        ballFee: 0,
        otherFee: 0,
        carAllowancePerCar: 0,
        attendees: [],
      }),
    ).toThrowError("NO_PLAYERS");
  });
});

describe("ceilSplit", () => {
  it("common-debit split 3000/14: share 215, recovered 3010, surplus 10", () => {
    const result = ceilSplit(3000, 14);
    expect(result.share).toBe(215);
    expect(result.players).toBe(14);
    expect(result.recovered).toBe(3010);
    expect(result.surplus).toBe(10);
  });

  it("zero active players is rejected", () => {
    expect(() => ceilSplit(3000, 0)).toThrowError("NO_PLAYERS");
  });
});

describe("carFee", () => {
  it("round trip at ₹9.6/km, ceiled: 7.3 km → 141 (140.16 up)", () => {
    expect(carFee(7.3, 9.6)).toBe(141);
  });

  it("fractional result is ceiled: 7.36 km → 142 (141.312 up)", () => {
    expect(carFee(7.36, 9.6)).toBe(142);
  });

  it("zero distance is a zero fee", () => {
    expect(carFee(0, 9.6)).toBe(0);
  });

  it("negative distance is rejected", () => {
    expect(() => carFee(-1, 9.6)).toThrowError("NEGATIVE_DISTANCE");
  });
});

describe("virtualFee", () => {
  const CHARGES = [200, 200, 150, 75, 35];
  const fiveBatsmen = (ramesheBalls: number) => [
    { name: "Ramesh", ballsFaced: ramesheBalls },
    { name: "B2", ballsFaced: 0 },
    { name: "B3", ballsFaced: 0 },
    { name: "B4", ballsFaced: 0 },
    { name: "B5", ballsFaced: 0 },
  ];

  it("canonical (remainder 1400): Ramesh pos 1 × 10 balls → 277, Suresh 12 balls → 93", () => {
    // 2060 − 660 fixed = 1400 → pools 700/700 over 90 balls.
    const result = virtualFee({
      matchFee: 2060,
      overs: 15,
      positionCharges: CHARGES,
      batsmen: fiveBatsmen(10),
      bowlers: [{ name: "Suresh", ballsBowled: 12 }],
    });
    expect(result.totalBalls).toBe(90);
    expect(result.fixedTotal).toBe(660);
    expect(result.battingPool).toBe(700);
    expect(result.bowlingPool).toBe(700);
    expect(result.batsmen[0].total).toBe(277); // 200 + floor(77.78)
    expect(result.batsmen[1].total).toBe(200); // fixed only
    expect(result.bowlers[0].fee).toBe(93); // floor(93.33)
  });

  it("fee 2000: remainder is 1340 → pools 670, Ramesh 274, Suresh 89", () => {
    const result = virtualFee({
      matchFee: 2000,
      overs: 15,
      positionCharges: CHARGES,
      batsmen: fiveBatsmen(10),
      bowlers: [{ name: "Suresh", ballsBowled: 12 }],
    });
    expect(result.remainder).toBe(1340);
    expect(result.batsmen[0].total).toBe(274); // 200 + floor(74.44)
    expect(result.bowlers[0].fee).toBe(89); // floor(89.33)
  });

  it("position 6+ has no fixed charge — per-ball only; unoccupied charges don't count", () => {
    const result = virtualFee({
      matchFee: 2060,
      overs: 15,
      positionCharges: CHARGES,
      batsmen: [...fiveBatsmen(0), { name: "B6", ballsFaced: 9 }],
      bowlers: [],
    });
    expect(result.batsmen[5].fixedCharge).toBe(0);
    expect(result.batsmen[5].total).toBe(70); // floor(9 × 700/90)
    // Only 3 batsmen → only the first 3 charges come off the fee.
    const three = virtualFee({
      matchFee: 2060,
      overs: 15,
      positionCharges: CHARGES,
      batsmen: fiveBatsmen(0).slice(0, 3),
      bowlers: [],
    });
    expect(three.fixedTotal).toBe(550);
    expect(three.remainder).toBe(1510);
  });

  it("a player who bats and bowls gets one combined total", () => {
    const result = virtualFee({
      matchFee: 2060,
      overs: 15,
      positionCharges: CHARGES,
      batsmen: fiveBatsmen(10),
      bowlers: [
        { name: "Ramesh ", ballsBowled: 12 }, // trailing space still merges
        { name: "Suresh", ballsBowled: 6 },
      ],
    });
    const ramesh = result.totals.find((t) => t.name === "Ramesh");
    expect(ramesh?.amount).toBe(277 + 93);
    expect(result.totals).toHaveLength(6); // 5 batsmen + Suresh
  });

  it("zero overs is rejected", () => {
    expect(() =>
      virtualFee({
        matchFee: 2000,
        overs: 0,
        positionCharges: CHARGES,
        batsmen: [],
        bowlers: [],
      }),
    ).toThrowError("NO_BALLS");
  });
});
