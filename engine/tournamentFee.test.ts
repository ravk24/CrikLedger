import { describe, expect, it } from "vitest";
import {
  calculateTournamentFees,
  type TournamentFeeResult,
} from "./tournamentFee";

// Helper: a match with attendees by player id; drivers bring a car.
const match = (
  matchId: string,
  ids: string[],
  drivers: string[] = [],
  allowance = 0,
) => ({
  matchId,
  carAllowancePerCar: allowance,
  attendees: ids.map((id) => ({
    playerId: id,
    broughtCar: drivers.includes(id),
  })),
});

// The fund-favoring invariant plus lines↔rows consistency, asserted
// on every case: collected ≥ joiningFee (surplus ≥ 0), and each
// player's row is exactly the sum of their per-match lines.
function expectInvariants(result: TournamentFeeResult, joiningFee: number) {
  expect(result.surplus).toBeGreaterThanOrEqual(0);
  expect(result.collected - joiningFee).toBe(result.surplus);
  expect(result.rows.reduce((sum, r) => sum + r.charge, 0)).toBe(
    result.collected,
  );
  for (const row of result.rows) {
    const lines = result.lines.filter((l) => l.playerId === row.playerId);
    expect(lines).toHaveLength(row.played);
    expect(lines.reduce((sum, l) => sum + l.share, 0)).toBe(
      row.charge + row.driverCredit,
    );
    expect(lines.reduce((sum, l) => sum + l.driverCredit, 0)).toBe(
      row.driverCredit,
    );
  }
}

const p = (n: number) => `p${n}`;
const players = (n: number) => Array.from({ length: n }, (_, i) => p(i + 1));

describe("calculateTournamentFees (per-match model)", () => {
  it("splits each match's own pot (Ravi's canonical example)", () => {
    // Fee 15000 across 5 completed matches → 3000/match (fractional
    // stays exact here). m1 has 2 cars @250 → CEIL(3500/12) = 292;
    // m2's cars are ignored (allowance 0) → CEIL(3000/11) = 273.
    const result = calculateTournamentFees({
      joiningFee: 15000,
      matches: [
        match("m1", players(12), [p(1), p(2)], 250),
        match("m2", players(11)),
        match("m3", players(10), [p(3)], 300),
        match("m4", players(8)),
        match("m5", players(9)),
      ],
    });

    expect(result.matchCount).toBe(5);
    expect(result.costPerMatch).toBe(3000);
    const shareOf = (id: string) =>
      result.matches.find((m) => m.matchId === id)?.share;
    expect(shareOf("m1")).toBe(292); // CEIL(3500/12)
    expect(shareOf("m2")).toBe(273); // CEIL(3000/11)
    expect(shareOf("m3")).toBe(330); // (3000+300)/10 exact
    expect(shareOf("m4")).toBe(375); // 3000/8 exact
    expect(shareOf("m5")).toBe(334); // CEIL(3000/9)

    const rowOf = (id: string) => result.rows.find((r) => r.playerId === id);
    // Same player, different rate per match: p11 played m1 and m2 only.
    expect(rowOf(p(11))?.charge).toBe(292 + 273);
    expect(rowOf(p(12))?.charge).toBe(292);
    // All five matches = 292+273+330+375+334 = 1604; the m1 drivers
    // get their 250 back, the m3 driver 300.
    expect(rowOf(p(4))?.charge).toBe(1604);
    expect(rowOf(p(1))?.charge).toBe(1604 - 250);
    expect(rowOf(p(3))?.charge).toBe(1604 - 300);

    expect(result.collected).toBe(15013);
    expect(result.surplus).toBe(13);
    expectInvariants(result, 15000);
  });

  it("never pre-rounds costPerMatch (only the per-match share ceils)", () => {
    // 10000/3 = 3333.33… — share must be CEIL(3333.33/1) = 3334.
    // Nearest- or floor-rounding costPerMatch first would give
    // 3333 and under-collect the fee (surplus −1).
    const result = calculateTournamentFees({
      joiningFee: 10000,
      matches: [
        match("m1", ["a"]),
        match("m2", ["b"]),
        match("m3", ["c"]),
      ],
    });
    expect(result.matches.every((m) => m.share === 3334)).toBe(true);
    expect(result.collected).toBe(10002);
    expect(result.surplus).toBe(2);
    expectInvariants(result, 10000);
  });

  it("accrues the ceil excess per match into one surplus", () => {
    // 100/3 = 33.33…/match; CEIL(33.33/3) = 12 → 36 collected per
    // match, 108 total, surplus 8.
    const result = calculateTournamentFees({
      joiningFee: 100,
      matches: [
        match("m1", ["a", "b", "c"]),
        match("m2", ["a", "b", "c"]),
        match("m3", ["a", "b", "c"]),
      ],
    });
    expect(result.matches.every((m) => m.share === 12)).toBe(true);
    expect(result.collected).toBe(108);
    expect(result.surplus).toBe(8);
    expectInvariants(result, 100);
  });

  it("credits drivers per match and allows a negative charge", () => {
    // fee 0; one match, big allowance: the lone driver nets a credit.
    const result = calculateTournamentFees({
      joiningFee: 0,
      matches: [match("m1", ["a", "b", "c"], ["a"], 300)],
    });
    expect(result.matches[0].share).toBe(100); // CEIL(300/3)
    expect(result.rows.find((r) => r.playerId === "a")?.charge).toBe(-200);
    expect(result.collected).toBe(0);
    expect(result.surplus).toBe(0);
    expectInvariants(result, 0);
  });

  it("redistributes car money within each match only (fee 0)", () => {
    // m1: a drives @100 for a,b → share 50, a nets −50.
    // m2: b drives @90 for a,b,c → share 30, b nets −60 that match.
    const result = calculateTournamentFees({
      joiningFee: 0,
      matches: [
        match("m1", ["a", "b"], ["a"], 100),
        match("m2", ["a", "b", "c"], ["b"], 90),
      ],
    });
    const rowOf = (id: string) => result.rows.find((r) => r.playerId === id);
    expect(rowOf("a")?.charge).toBe(50 + 30 - 100);
    expect(rowOf("b")?.charge).toBe(50 + 30 - 90);
    expect(rowOf("c")?.charge).toBe(30);
    expect(result.surplus).toBe(0);
    expectInvariants(result, 0);
  });

  it("matches the single-pot formula when there is one match", () => {
    const result = calculateTournamentFees({
      joiningFee: 1000,
      matches: [match("m1", ["a", "b", "c"], ["a"], 100)],
    });
    expect(result.matches[0].share).toBe(367); // CEIL(1100/3)
    expect(result.rows.find((r) => r.playerId === "a")?.charge).toBe(267);
    expect(result.collected).toBe(1001);
    expect(result.surplus).toBe(1);
    expectInvariants(result, 1000);
  });

  it("throws when there are no completed matches or an empty match", () => {
    expect(() =>
      calculateTournamentFees({ joiningFee: 5000, matches: [] }),
    ).toThrow("NO_COMPLETED_MATCHES");
    expect(() =>
      calculateTournamentFees({
        joiningFee: 5000,
        matches: [match("m1", [])],
      }),
    ).toThrow("EMPTY_MATCH_ATTENDEES");
  });
});
