import { describe, expect, it } from "vitest";
import { calculateMatchFees, type Attendee, type Guest } from "./calc";
import { carFee } from "./carFee";
import { ceilSplit } from "./split";

// `drivers` bring a car (always sharers); `shared` is the set of
// non-driver indices who rode along; everyone else made their own way.
function people(
  count: number,
  drivers = 0,
  shared: "all" | "none" | number[] = "all",
): Attendee[] {
  return Array.from({ length: count }, (_, i) => ({
    playerId: `p${i + 1}`,
    broughtCar: i < drivers,
    sharedCar:
      shared === "all" ? true : shared === "none" ? false : shared.includes(i),
  }));
}

const sample = {
  groundFee: 2500,
  ballFee: 60,
  otherFee: 0,
  carAllowancePerCar: 250,
};

const fees = (r: { rows: { playerId: string; fee: number }[] }, id: string) =>
  r.rows.find((x) => x.playerId === id)!.fee;

describe("calculateMatchFees — THE rule (drivers always share the car pot)", () => {
  it("canonical 1: 2560 + 3 cars, 13 heads all shared → base 197, car 58, riders 255, drivers 5, surplus 5", () => {
    const guests: Guest[] = [
      { name: "Abc", broughtCar: false, sharedCar: true },
      { name: "def", broughtCar: false, sharedCar: true },
    ];
    const r = calculateMatchFees({ ...sample, attendees: people(11, 3), guests });
    expect(r.totalCost).toBe(3310);
    expect(r.cashCosts).toBe(2560);
    expect(r.headCount).toBe(13);
    expect(r.carCount).toBe(3);
    expect(r.sharerCount).toBe(13);
    expect(r.ownWayCount).toBe(0);
    expect(r.perPlayerFee).toBe(197); // CEIL(2560 / 13)
    expect(r.carSharePerSharer).toBe(58); // CEIL(750 / 13)
    expect(r.rows.filter((x) => x.broughtCar).map((x) => x.fee)).toEqual([5, 5, 5]);
    expect(r.rows.filter((x) => !x.broughtCar).every((x) => x.fee === 255)).toBe(true);
    expect(r.rows.every((x) => x.sharedCar)).toBe(true);
    expect(r.guestRows.map((g) => g.fee)).toEqual([255, 255]);
    expect(r.captainCharge).toBe(510);
    expect(r.collectedTotal).toBe(2565); // 8×255 + 3×5 + 510
    expect(r.surplusToPool).toBe(5);
  });

  it("canonical 2: same match, the 2 guests came on their own → car 69, riders 266, drivers 16, guests 197, surplus 10", () => {
    const guests: Guest[] = [
      { name: "Abc", broughtCar: false, sharedCar: false },
      { name: "def", broughtCar: false, sharedCar: false },
    ];
    const r = calculateMatchFees({ ...sample, attendees: people(11, 3), guests });
    expect(r.totalCost).toBe(3310);
    expect(r.sharerCount).toBe(11);
    expect(r.ownWayCount).toBe(2);
    expect(r.perPlayerFee).toBe(197);
    expect(r.carSharePerSharer).toBe(69); // CEIL(750 / 11)
    expect(r.rows.filter((x) => x.broughtCar).map((x) => x.fee)).toEqual([16, 16, 16]);
    expect(r.rows.filter((x) => !x.broughtCar).every((x) => x.fee === 266)).toBe(true);
    expect(r.guestRows.map((g) => g.fee)).toEqual([197, 197]);
    expect(r.guestRows.every((g) => !g.sharedCar)).toBe(true);
    expect(r.captainCharge).toBe(394);
    expect(r.collectedTotal).toBe(2570); // 8×266 + 3×16 + 2×197
    expect(r.surplusToPool).toBe(10);
  });

  it("canonical 3: one pooled pot, never per car — 2 cars, 9 sharers → 500/9 = 56 each", () => {
    // 11 players: p1, p2 drive; p3–p9 rode (7); p10, p11 own way.
    // Which car anyone sat in is irrelevant: 500 across 9, not 250/5 + 250/4.
    const r = calculateMatchFees({
      ...sample,
      attendees: people(11, 2, [2, 3, 4, 5, 6, 7, 8]),
    });
    expect(r.sharerCount).toBe(9);
    expect(r.ownWayCount).toBe(2);
    expect(r.perPlayerFee).toBe(233); // CEIL(2560 / 11)
    expect(r.carSharePerSharer).toBe(56); // CEIL(500 / 9)
    expect(fees(r, "p1")).toBe(233 + 56 - 250); // 39
    expect(fees(r, "p3")).toBe(289);
    expect(fees(r, "p10")).toBe(233);
    expect(r.collectedTotal).toBe(7 * 289 + 2 * 39 + 2 * 233); // 2567
    expect(r.surplusToPool).toBe(7);
  });

  it("canonical 4: a driver who carried nobody is the sole sharer — pays the pot, gets it back, nets the base share", () => {
    const r = calculateMatchFees({ ...sample, attendees: people(11, 1, "none") });
    expect(r.sharerCount).toBe(1);
    expect(r.carSharePerSharer).toBe(250);
    expect(r.totalCost).toBe(2810);
    expect(r.rows.every((x) => x.fee === 233)).toBe(true);
    expect(r.collectedTotal).toBe(2563);
    expect(r.surplusToPool).toBe(3);
  });

  it("three drivers, nobody else ticked: the three split their own 750 and net the base share", () => {
    const r = calculateMatchFees({ ...sample, attendees: people(11, 3, "none") });
    expect(r.sharerCount).toBe(3);
    expect(r.carSharePerSharer).toBe(250);
    expect(r.totalCost).toBe(3310);
    expect(r.rows.every((x) => x.fee === 233)).toBe(true);
    expect(r.surplusToPool).toBe(3);
  });

  it("canonical 5 (dev seed): 2060 + 2 cars @250, 12 heads all shared → 214, drivers gets ₹36, collected 2068, surplus 8", () => {
    const r = calculateMatchFees({
      groundFee: 2000,
      ballFee: 60,
      otherFee: 0,
      carAllowancePerCar: 250,
      attendees: people(12, 2),
    });
    expect(r.totalCost).toBe(2560);
    expect(r.perPlayerFee).toBe(172); // CEIL(2060 / 12)
    expect(r.carSharePerSharer).toBe(42); // CEIL(500 / 12)
    expect(r.rows.filter((x) => x.broughtCar).map((x) => x.fee)).toEqual([-36, -36]);
    expect(r.rows.filter((x) => !x.broughtCar).every((x) => x.fee === 214)).toBe(true);
    expect(r.collectedTotal).toBe(2068);
    expect(r.surplusToPool).toBe(8);
  });

  it("canonical 6 (demo sample): 2560 + 3 cars, 11 players all shared → CEIL(3310/11) = 301, drivers 51, surplus 1", () => {
    // One ceiling over 232.73 + 68.18 = 300.9 → 301. Two separate
    // ceilings (233 + 69 = 302) would leave surplus 12 from 11 heads.
    const r = calculateMatchFees({ ...sample, attendees: people(11, 3) });
    expect(r.perPlayerFee).toBe(233);
    expect(r.carSharePerSharer).toBe(68); // 301 − 233
    expect(fees(r, "p1")).toBe(51);
    expect(fees(r, "p4")).toBe(301);
    expect(r.collectedTotal).toBe(2561); // 8×301 + 3×51
    expect(r.surplusToPool).toBe(1);
  });

  it("the owner's case: cash 3565 + 3 cars @250, 11 players all shared → 393, surplus 8 (not 394 / 19)", () => {
    const r = calculateMatchFees({
      groundFee: 3500,
      ballFee: 65,
      otherFee: 0,
      carAllowancePerCar: 250,
      attendees: people(11, 3),
    });
    expect(r.totalCost).toBe(4315);
    expect(r.perPlayerFee + r.carSharePerSharer).toBe(393); // CEIL(4315 / 11)
    expect(fees(r, "p4")).toBe(393);
    expect(fees(r, "p1")).toBe(143);
    expect(r.collectedTotal).toBe(3573); // 8×393 + 3×143
    expect(r.surplusToPool).toBe(8);
  });

  it("ticking a driver as shared changes nothing — they are a sharer either way", () => {
    const ticked = calculateMatchFees({ ...sample, attendees: people(11, 3, [0, 1, 2, 3, 4, 5, 6, 7, 8]) });
    const unticked = calculateMatchFees({ ...sample, attendees: people(11, 3, [3, 4, 5, 6, 7, 8]) });
    expect(ticked).toEqual(unticked);
    expect(ticked.rows[0].sharedCar).toBe(true);
    expect(unticked.rows[0].sharedCar).toBe(true);
  });

  it("mixed: 3 drivers, 6 riders, 2 own way → base 233, car 84, rider 317, own way 233, driver 67, surplus 9", () => {
    const r = calculateMatchFees({ ...sample, attendees: people(11, 3, [3, 4, 5, 6, 7, 8]) });
    expect(r.sharerCount).toBe(9);
    expect(r.ownWayCount).toBe(2);
    expect(r.perPlayerFee).toBe(233);
    expect(r.carSharePerSharer).toBe(84); // CEIL(750 / 9)
    expect(fees(r, "p4")).toBe(317);
    expect(fees(r, "p10")).toBe(233);
    expect(fees(r, "p1")).toBe(67);
    expect(r.collectedTotal).toBe(2569); // 6×317 + 2×233 + 3×67
    expect(r.surplusToPool).toBe(9);
  });

  it("exact division: 2400/12, no cars — 200 each, no sharers, surplus 0", () => {
    const r = calculateMatchFees({
      groundFee: 2400,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 250,
      attendees: people(12, 0, "none"),
    });
    expect(r.perPlayerFee).toBe(200);
    expect(r.carCount).toBe(0);
    expect(r.sharerCount).toBe(0);
    expect(r.carSharePerSharer).toBe(0);
    expect(r.totalCost).toBe(2400);
    expect(r.collectedTotal).toBe(2400);
    expect(r.surplusToPool).toBe(0);
  });

  it("allowance > share: 500 ground, 1 car @300, 5 all shared → 100 + 60, driver −140 (a credit, preserved)", () => {
    const r = calculateMatchFees({
      groundFee: 500,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 300,
      attendees: people(5, 1),
    });
    expect(r.perPlayerFee).toBe(100);
    expect(r.carSharePerSharer).toBe(60);
    expect(r.rows[0].fee).toBe(-140);
    expect(r.rows.slice(1).every((x) => x.fee === 160)).toBe(true);
    expect(r.collectedTotal).toBe(500);
    expect(r.surplusToPool).toBe(0);
  });

  it("guests join the split: 3600 over 10 players + 2 guests, no cars → 300 each, captain owes 600", () => {
    const r = calculateMatchFees({
      groundFee: 3600,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 250,
      attendees: people(10, 0, "none"),
      guests: [
        { name: "Guest A", broughtCar: false },
        { name: "Guest B", broughtCar: false },
      ],
    });
    expect(r.totalCost).toBe(3600);
    expect(r.perPlayerFee).toBe(300);
    expect(r.rows.every((x) => x.fee === 300)).toBe(true);
    expect(r.guestRows.map((g) => g.fee)).toEqual([300, 300]);
    expect(r.captainCharge).toBe(600);
    expect(r.collectedTotal).toBe(3600);
    expect(r.surplusToPool).toBe(0);
  });

  it("a guest who drove is a sharer and gets the rebate, reducing the captain charge", () => {
    // 3350 cash + guest car 250 = 3600; 12 heads all shared:
    // base CEIL(3350/12) = 280, sharer CEIL(3600/12) = 300 exactly.
    const r = calculateMatchFees({
      groundFee: 3350,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 250,
      attendees: people(10),
      guests: [
        { name: "Guest A", broughtCar: true },
        { name: "Guest B", broughtCar: false, sharedCar: true },
      ],
    });
    expect(r.totalCost).toBe(3600);
    expect(r.carCount).toBe(1);
    expect(r.sharerCount).toBe(12);
    expect(r.perPlayerFee).toBe(280);
    expect(r.carSharePerSharer).toBe(20);
    expect(r.rows.every((x) => x.fee === 300)).toBe(true);
    expect(r.guestRows.map((g) => g.fee)).toEqual([50, 300]);
    expect(r.guestRows[0].sharedCar).toBe(true);
    expect(r.captainCharge).toBe(350);
    expect(r.collectedTotal).toBe(3350);
    expect(r.surplusToPool).toBe(0);
  });

  it("a guest driver can go net-negative, and that reduces the captain charge", () => {
    // 500 cash, guest car @300, 5 heads all shared → 100 + 60.
    const r = calculateMatchFees({
      groundFee: 500,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 300,
      attendees: people(3),
      guests: [
        { name: "Guest A", broughtCar: true },
        { name: "Guest B", broughtCar: false, sharedCar: true },
      ],
    });
    expect(r.perPlayerFee).toBe(100);
    expect(r.carSharePerSharer).toBe(60);
    expect(r.rows.every((x) => x.fee === 160)).toBe(true);
    expect(r.guestRows.map((g) => g.fee)).toEqual([-140, 160]);
    expect(r.captainCharge).toBe(20);
    expect(r.surplusToPool).toBe(0);
  });

  it("no guests: guestRows empty, captainCharge 0", () => {
    const r = calculateMatchFees({ ...sample, attendees: people(11, 3) });
    expect(r.guestRows).toEqual([]);
    expect(r.captainCharge).toBe(0);
  });

  it("1 attendee who is the only driver: pays the pot, gets it back, no divide-by-zero", () => {
    const r = calculateMatchFees({
      groundFee: 1000,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 250,
      attendees: people(1, 1),
    });
    expect(r.totalCost).toBe(1250);
    expect(r.perPlayerFee).toBe(1000);
    expect(r.carSharePerSharer).toBe(250);
    expect(r.rows[0].fee).toBe(1000);
    expect(r.collectedTotal).toBe(1000);
    expect(r.surplusToPool).toBe(0);
  });

  it("all fees 0 with drivers: every fee 0, surplus 0", () => {
    const r = calculateMatchFees({
      groundFee: 0,
      ballFee: 0,
      otherFee: 0,
      carAllowancePerCar: 0,
      attendees: people(11, 2),
    });
    expect(r.rows.every((x) => x.fee === 0)).toBe(true);
    expect(r.collectedTotal).toBe(0);
    expect(r.surplusToPool).toBe(0);
  });

  it("car fee ignored (allowance 0) with drivers: no car money, everyone pays the base share", () => {
    const r = calculateMatchFees({ ...sample, carAllowancePerCar: 0, attendees: people(11, 2) });
    expect(r.carCount).toBe(2);
    expect(r.carSharePerSharer).toBe(0);
    expect(r.totalCost).toBe(2560);
    expect(r.rows.every((x) => x.fee === 233)).toBe(true);
  });

  it("invariants hold across drivers × riders × guests: surplus ≥ 0, below the head count, one ceiling per head", () => {
    for (const drivers of [0, 1, 3, 5]) {
      for (const riders of [0, 1, 4, 6]) {
        for (const guestCount of [0, 2]) {
          const shared = Array.from({ length: riders }, (_, i) => drivers + i);
          const guests: Guest[] = Array.from({ length: guestCount }, (_, i) => ({
            name: `g${i}`,
            broughtCar: false,
            sharedCar: i === 0,
          }));
          const r = calculateMatchFees({ ...sample, attendees: people(11, drivers, shared), guests });
          const cars = r.carCount * sample.carAllowancePerCar;
          expect(r.carCount).toBe(drivers);
          expect(r.sharerCount).toBeGreaterThanOrEqual(r.carCount);
          expect(r.totalCost).toBe(r.cashCosts + cars);
          expect(r.collectedTotal).toBe(
            r.rows.reduce((s, x) => s + x.fee, 0) + r.captainCharge,
          );
          expect(r.surplusToPool).toBeGreaterThanOrEqual(0);
          // Every head rounds up by less than a rupee, so the surplus
          // can never reach the head count.
          expect(r.surplusToPool).toBeLessThan(r.headCount);
          const sharerFee = r.perPlayerFee + r.carSharePerSharer;
          expect(r.perPlayerFee).toBe(Math.ceil(r.cashCosts / r.headCount));
          expect(sharerFee).toBe(
            cars > 0 && r.sharerCount > 0
              ? Math.ceil(
                  (r.cashCosts * r.sharerCount + cars * r.headCount) /
                    (r.headCount * r.sharerCount),
                )
              : r.perPlayerFee,
          );
          expect(r.collectedTotal).toBe(
            r.sharerCount * sharerFee + r.ownWayCount * r.perPlayerFee - cars,
          );
        }
      }
    }
  });

  it("zero attendees is rejected", () => {
    expect(() =>
      calculateMatchFees({ ...sample, attendees: [] }),
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
