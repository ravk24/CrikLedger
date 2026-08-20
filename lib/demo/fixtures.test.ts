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

const run = () =>
  calculateMatchFees({
    groundFee: Number(DEMO_COSTS.ground),
    ballFee: Number(DEMO_COSTS.ball),
    otherFee: Number(DEMO_COSTS.other),
    carAllowancePerCar: Number(DEMO_COSTS.allowance),
    attendees: DEMO_PLAYERS.map((p) => ({
      playerId: p.id,
      broughtCar: (DEMO_DRIVERS as readonly string[]).includes(p.id),
    })),
    guests: [],
  });

describe("guest sample match", () => {
  it("produces a fee for every player", () => {
    const result = run();
    expect(result.rows).toHaveLength(DEMO_PLAYERS.length);
  });

  it("balances: collected covers the cash costs, surplus is never negative", () => {
    const result = run();
    const cash =
      Number(DEMO_COSTS.ground) +
      Number(DEMO_COSTS.ball) +
      Number(DEMO_COSTS.other);
    expect(result.collectedTotal).toBeGreaterThanOrEqual(cash);
    expect(result.surplusToPool).toBeGreaterThanOrEqual(0);
  });

  it("charges non-drivers a positive fee and credits drivers the allowance", () => {
    const result = run();
    const allowance = Number(DEMO_COSTS.allowance);
    for (const row of result.rows) {
      const other = result.rows.find((r) => !r.broughtCar)!;
      if (row.broughtCar) {
        expect(row.fee).toBe(other.fee - allowance);
      } else {
        expect(row.fee).toBeGreaterThan(0);
      }
    }
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
  it("charges a guest's fee to the captain", () => {
    const withGuest = calculateMatchFees({
      groundFee: Number(DEMO_COSTS.ground),
      ballFee: Number(DEMO_COSTS.ball),
      otherFee: Number(DEMO_COSTS.other),
      carAllowancePerCar: Number(DEMO_COSTS.allowance),
      attendees: DEMO_PLAYERS.map((p) => ({
        playerId: p.id,
        broughtCar: (DEMO_DRIVERS as readonly string[]).includes(p.id),
      })),
      guests: [{ name: "Ravi", broughtCar: false }],
    });
    expect(withGuest.guestRows).toHaveLength(1);
    expect(withGuest.captainCharge).toBe(withGuest.guestRows[0].fee);
    expect(withGuest.captainCharge).toBeGreaterThan(0);
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
