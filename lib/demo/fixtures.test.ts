import { describe, expect, it } from "vitest";
import { calculateMatchFees } from "@/engine/calc";
import {
  DEMO_COSTS,
  DEMO_DRIVERS,
  DEMO_LEDGER,
  DEMO_PLAYERS,
  DEMO_POOL_BALANCE,
} from "./fixtures";

// The guest sample is the first thing a stranger sees, and it runs the
// real fee engine on this data. If a fixture is edited into something
// nonsensical (a negative fee, a split that doesn't balance), the sample
// silently starts misrepresenting the product. These tests are the guard.

const drove = (id: string) =>
  (DEMO_DRIVERS as readonly string[]).includes(id);

// Mirrors what the sample opens with: everyone shared a car (the wizard
// default), three of them drove.
const run = (guests: { name: string; broughtCar: boolean; sharedCar: boolean }[] = []) =>
  calculateMatchFees({
    groundFee: Number(DEMO_COSTS.ground),
    ballFee: Number(DEMO_COSTS.ball),
    otherFee: Number(DEMO_COSTS.other),
    carAllowancePerCar: Number(DEMO_COSTS.allowance),
    attendees: DEMO_PLAYERS.map((p) => ({
      playerId: p.id,
      broughtCar: drove(p.id),
      sharedCar: true,
    })),
    guests,
  });

describe("guest sample match", () => {
  it("produces a fee for every player", () => {
    expect(run().rows).toHaveLength(DEMO_PLAYERS.length);
  });

  it("is the canonical 2560 + 3 cars over 11 heads: 233 + 69, riders 302, drivers 52, surplus 12", () => {
    const result = run();
    expect(result.totalCost).toBe(3310);
    expect(result.perPlayerFee).toBe(233);
    expect(result.carSharePerSharer).toBe(69);
    expect(result.sharerCount).toBe(11);
    expect(result.ownWayCount).toBe(0);
    for (const row of result.rows) {
      expect(row.fee).toBe(row.broughtCar ? 52 : 302);
      expect(row.sharedCar).toBe(true);
    }
    expect(result.collectedTotal).toBe(2572);
    expect(result.surplusToPool).toBe(12);
  });

  it("its ledger row is what the sample match collects", () => {
    expect(DEMO_LEDGER[0].amount).toBe(run().collectedTotal);
  });

  it("has exactly one captain — the guest charge lands on them", () => {
    const captains = DEMO_PLAYERS.filter((p) => p.is_captain);
    expect(captains).toHaveLength(1);
  });

  it("has drivers that actually exist in the roster", () => {
    const ids = new Set(DEMO_PLAYERS.map((p) => p.id));
    for (const d of DEMO_DRIVERS) expect(ids.has(d)).toBe(true);
  });

  it("charges nothing to the captain when nobody brought a guest", () => {
    expect(run().captainCharge).toBe(0);
  });

  // The sample's guests step adds guests to this same call. Their fees
  // land on the captain, so the roster must keep one.
  it("charges a guest's fee to the captain — a sharing guest pays like a rider", () => {
    const withGuest = run([{ name: "Ravi", broughtCar: false, sharedCar: true }]);
    // 12 heads: base CEIL(2560/12) = 214, car CEIL(750/12) = 63.
    expect(withGuest.perPlayerFee).toBe(214);
    expect(withGuest.carSharePerSharer).toBe(63);
    expect(withGuest.guestRows).toHaveLength(1);
    expect(withGuest.guestRows[0].fee).toBe(277);
    expect(withGuest.captainCharge).toBe(277);
  });

  it("a guest who came on their own pays only the base share", () => {
    const withGuest = run([{ name: "Ravi", broughtCar: false, sharedCar: false }]);
    expect(withGuest.sharerCount).toBe(11);
    expect(withGuest.ownWayCount).toBe(1);
    expect(withGuest.carSharePerSharer).toBe(69);
    expect(withGuest.guestRows[0].fee).toBe(214);
    expect(withGuest.captainCharge).toBe(214);
  });
});

describe("guest sample ledger", () => {
  it("its stated balance is the sum of its rows", () => {
    const sum = DEMO_LEDGER.reduce((t, r) => t + r.amount, 0);
    expect(DEMO_POOL_BALANCE).toBe(sum);
  });

  it("is not accidentally in the red", () => {
    expect(DEMO_POOL_BALANCE).toBeGreaterThan(0);
  });

  it("shows both money in and money out", () => {
    expect(DEMO_LEDGER.some((r) => r.amount > 0)).toBe(true);
    expect(DEMO_LEDGER.some((r) => r.amount < 0)).toBe(true);
  });
});
