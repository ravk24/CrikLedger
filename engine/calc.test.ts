import { describe, expect, it } from "vitest";
import { calculateMatchFees, type Attendee } from "./calc";
import { carFee } from "./carFee";
import { ceilSplit } from "./split";

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

// The sharing rule: only people who rode with someone fund the cars.
// Every test above this point runs on the default "everyone" mode and
// must keep passing untouched — that is the back-compat proof.
describe("calculateMatchFees — carSplit: sharers", () => {
  const base = {
    groundFee: 2500,
    ballFee: 60,
    otherFee: 0,
    carAllowancePerCar: 250,
    carSplit: "sharers" as const,
  };

  // 11 players, base 2560, 3 drivers, 6 of the other 8 rode along.
  // base  2560 / 11 = 232.7 -> 233 a head
  // cars  3 * 250 = 750, / 6 sharers = 125
  const sharedRun = () =>
    calculateMatchFees({
      ...base,
      attendees: Array.from({ length: 11 }, (_, i) => ({
        playerId: `p${i + 1}`,
        broughtCar: i < 3,
        sharedCar: i >= 3 && i < 9,
      })),
    });

  it("splits the base across every head and the cars across sharers only", () => {
    const r = sharedRun();
    expect(r.perPlayerFee).toBe(233);
    expect(r.carSharePerSharer).toBe(125);
    expect(r.sharerCount).toBe(6);
  });

  it("charges a sharer base + car share, and someone who made their own way only the base", () => {
    const r = sharedRun();
    expect(r.rows.find((x) => x.playerId === "p4")!.fee).toBe(233 + 125);
    expect(r.rows.find((x) => x.playerId === "p10")!.fee).toBe(233);
  });

  it("never charges a driver toward the cars, and rebates them", () => {
    const r = sharedRun();
    const driver = r.rows.find((x) => x.playerId === "p1")!;
    expect(driver.fee).toBe(233 - 250);
    expect(driver.sharedCar).toBe(false);
  });

  it("ticking a driver as a sharer changes nothing — they provided the car", () => {
    const withDriverTicked = calculateMatchFees({
      ...base,
      attendees: Array.from({ length: 11 }, (_, i) => ({
        playerId: `p${i + 1}`,
        broughtCar: i < 3,
        sharedCar: i < 9,
      })),
    });
    expect(withDriverTicked.sharerCount).toBe(6);
    expect(withDriverTicked.rows[0].fee).toBe(233 - 250);
  });

  it("collects no car money and pays no rebate when nobody shared", () => {
    const r = calculateMatchFees({
      ...base,
      attendees: Array.from({ length: 11 }, (_, i) => ({
        playerId: `p${i + 1}`,
        broughtCar: i < 3,
        sharedCar: false,
      })),
    });
    expect(r.totalCost).toBe(2560);
    expect(r.carSharePerSharer).toBe(0);
    expect(r.rows.every((x) => x.fee === 233)).toBe(true);
  });

  it("lets a guest share, and charges the captain for it", () => {
    const r = calculateMatchFees({
      ...base,
      attendees: [
        { playerId: "p1", broughtCar: true },
        { playerId: "p2", broughtCar: false, sharedCar: true },
      ],
      guests: [{ name: "Ravi", broughtCar: false, sharedCar: true }],
    });
    // base 2560 / 3 heads = 853.3 -> 854; cars 250 / 2 sharers = 125
    expect(r.perPlayerFee).toBe(854);
    expect(r.sharerCount).toBe(2);
    expect(r.carSharePerSharer).toBe(125);
    expect(r.captainCharge).toBe(854 + 125);
  });

  it("keeps the pool whole — surplus is never negative", () => {
    for (const drivers of [0, 1, 3, 5]) {
      for (const sharers of [0, 1, 4, 6]) {
        const r = calculateMatchFees({
          ...base,
          attendees: Array.from({ length: 11 }, (_, i) => ({
            playerId: `p${i + 1}`,
            broughtCar: i < drivers,
            sharedCar: i >= drivers && i < drivers + sharers,
          })),
        });
        expect(r.surplusToPool).toBeGreaterThanOrEqual(0);
      }
    }
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
