import { describe, expect, it } from "vitest";
import {
  calculateTournamentFees,
  type TournamentFeeResult,
} from "./tournamentFee";

// Helper: a match with attendees by player id; drivers bring a car,
// sharers rode with someone and fund the car money.
const match = (
  matchId: string,
  ids: string[],
  drivers: string[] = [],
  allowance = 0,
  sharers: string[] = [],
) => ({
  matchId,
  carAllowancePerCar: allowance,
  attendees: ids.map((id) => ({
    playerId: id,
    broughtCar: drivers.includes(id),
    sharedCar: sharers.includes(id),
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
  it("splits each match's own slice, car money on the sharers", () => {
    // Fee 15000 across 5 completed matches → 3000/match (fractional
    // stays exact here). Base share = CEIL(3000 / attendees); car money
    // rides on top for the sharers only: m1 has 2 cars @250 shared by
    // p3–p6 → 500/4 = 125 each; m3 has 1 car @300 shared by p4–p6 →
    // 100 each. m2's car (allowance 0) is ignored.
    const result = calculateTournamentFees({
      joiningFee: 15000,
      matches: [
        match("m1", players(12), [p(1), p(2)], 250, [p(3), p(4), p(5), p(6)]),
        match("m2", players(11)),
        match("m3", players(10), [p(3)], 300, [p(4), p(5), p(6)]),
        match("m4", players(8)),
        match("m5", players(9)),
      ],
    });

    expect(result.matchCount).toBe(5);
    expect(result.costPerMatch).toBe(3000);
    const m = (id: string) => result.matches.find((x) => x.matchId === id)!;
    expect(m("m1").share).toBe(250); // 3000/12 exact
    expect(m("m1").carSharePerSharer).toBe(125);
    expect(m("m2").share).toBe(273); // CEIL(3000/11)
    expect(m("m3").share).toBe(300); // 3000/10 exact
    expect(m("m3").carSharePerSharer).toBe(100);
    expect(m("m4").share).toBe(375); // 3000/8 exact
    expect(m("m5").share).toBe(334); // CEIL(3000/9)

    const rowOf = (id: string) => result.rows.find((r) => r.playerId === id);
    // Same player, different rate per match: p11 played m1 and m2 only.
    expect(rowOf(p(11))?.charge).toBe(250 + 273);
    expect(rowOf(p(12))?.charge).toBe(250);
    // All five base shares = 250+273+300+375+334 = 1532. p7 just
    // played; p4 shared in m1 and m3; p1 drove in m1; p3 shared in m1
    // and drove in m3.
    expect(rowOf(p(7))?.charge).toBe(1532);
    expect(rowOf(p(4))?.charge).toBe(1532 + 125 + 100);
    expect(rowOf(p(1))?.charge).toBe(1532 - 250);
    expect(rowOf(p(3))?.charge).toBe(1532 + 125 - 300);

    // Car money nets to zero per match; only the base ceils surplus.
    expect(result.collected).toBe(15009);
    expect(result.surplus).toBe(9);
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
    // fee 0; one match, big allowance, both passengers shared: the
    // lone driver nets a credit funded by the sharers.
    const result = calculateTournamentFees({
      joiningFee: 0,
      matches: [match("m1", ["a", "b", "c"], ["a"], 300, ["b", "c"])],
    });
    expect(result.matches[0].share).toBe(0);
    expect(result.matches[0].carSharePerSharer).toBe(150);
    const rowOf = (id: string) => result.rows.find((r) => r.playerId === id);
    expect(rowOf("a")?.charge).toBe(-300);
    expect(rowOf("b")?.charge).toBe(150);
    expect(result.collected).toBe(0);
    expect(result.surplus).toBe(0);
    expectInvariants(result, 0);
  });

  it("redistributes car money within each match only (fee 0)", () => {
    // m1: a drives @100, b rides → b pays 100, a nets −100.
    // m2: b drives @90, a and c ride → 45 each, b nets −90 that match.
    const result = calculateTournamentFees({
      joiningFee: 0,
      matches: [
        match("m1", ["a", "b"], ["a"], 100, ["b"]),
        match("m2", ["a", "b", "c"], ["b"], 90, ["a", "c"]),
      ],
    });
    const rowOf = (id: string) => result.rows.find((r) => r.playerId === id);
    expect(rowOf("a")?.charge).toBe(-100 + 45);
    expect(rowOf("b")?.charge).toBe(100 - 90);
    expect(rowOf("c")?.charge).toBe(45);
    expect(result.surplus).toBe(0);
    expectInvariants(result, 0);
  });

  it("pays no rebate when nobody shared the car", () => {
    // Nobody rode with a, so there is nothing for the allowance to
    // compensate: no car money collected, no driver credit.
    const result = calculateTournamentFees({
      joiningFee: 300,
      matches: [match("m1", ["a", "b", "c"], ["a"], 100)],
    });
    expect(result.matches[0].carSharePerSharer).toBe(0);
    expect(result.rows.every((r) => r.charge === 100)).toBe(true);
    expect(result.rows.find((r) => r.playerId === "a")?.driverCredit).toBe(0);
    expect(result.surplus).toBe(0);
    expectInvariants(result, 300);
  });

  it("treats a driver who also ticked shared as a driver", () => {
    const result = calculateTournamentFees({
      joiningFee: 0,
      matches: [match("m1", ["a", "b"], ["a"], 100, ["a", "b"])],
    });
    expect(result.matches[0].sharers).toBe(1);
    expect(result.rows.find((r) => r.playerId === "a")?.charge).toBe(-100);
    expect(result.rows.find((r) => r.playerId === "b")?.charge).toBe(100);
    expectInvariants(result, 0);
  });

  it("stacks the car share on the base share for one match", () => {
    // fee 1000 / 3 → base 334 each; b rode with a → +100; a −100.
    const result = calculateTournamentFees({
      joiningFee: 1000,
      matches: [match("m1", ["a", "b", "c"], ["a"], 100, ["b"])],
    });
    expect(result.matches[0].share).toBe(334); // CEIL(1000/3)
    const rowOf = (id: string) => result.rows.find((r) => r.playerId === id);
    expect(rowOf("a")?.charge).toBe(234);
    expect(rowOf("b")?.charge).toBe(434);
    expect(rowOf("c")?.charge).toBe(334);
    expect(result.collected).toBe(1002);
    expect(result.surplus).toBe(2);
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
