import { describe, expect, it } from "vitest";
import {
  calculateTournamentFees,
  type TournamentFeeResult,
} from "./tournamentFee";

// Helper: a match with attendees by player id; drivers bring a car
// (and are sharers by definition), `sharers` rode along; everyone
// else made their own way.
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
// on every case: collected ≥ joiningFee (surplus ≥ 0), each player's
// row is exactly the sum of their per-match lines, and every match has
// at least as many sharers as cars.
function expectInvariants(result: TournamentFeeResult, joiningFee: number) {
  expect(result.surplus).toBeGreaterThanOrEqual(0);
  expect(result.collected - joiningFee).toBe(result.surplus);
  expect(result.rows.reduce((sum, r) => sum + r.charge, 0)).toBe(
    result.collected,
  );
  for (const m of result.matches) {
    expect(m.sharers).toBeGreaterThanOrEqual(m.cars);
  }
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
  it("canonical single match: 2560 fee, 11 players, 3 drivers @250, all shared → 233 + 69, riders 302, drivers 52, surplus 12", () => {
    const result = calculateTournamentFees({
      joiningFee: 2560,
      matches: [
        match("m1", players(11), [p(1), p(2), p(3)], 250, players(11)),
      ],
    });
    expect(result.matches[0].share).toBe(233); // CEIL(2560 / 11)
    expect(result.matches[0].sharers).toBe(11);
    expect(result.matches[0].carSharePerSharer).toBe(69); // CEIL(750 / 11)
    const rowOf = (id: string) => result.rows.find((r) => r.playerId === id);
    expect(rowOf(p(1))?.charge).toBe(52);
    expect(rowOf(p(1))?.driverCredit).toBe(250);
    expect(rowOf(p(4))?.charge).toBe(302);
    expect(result.collected).toBe(2572);
    expect(result.surplus).toBe(12);
    expectInvariants(result, 2560);
  });

  it("splits each match's own slice, car money pooled across drivers and riders", () => {
    // Fee 15000 across 5 completed matches → 3000/match (fractional
    // stays exact here). Base share = CEIL(3000 / attendees); car money
    // rides on top for the sharers, drivers included: m1 has 2 cars
    // @250 with p3–p6 riding → 6 sharers, CEIL(500/6) = 84 each; m3 has
    // 1 car @300 with p4–p6 riding → 4 sharers, 75 each. m2's car
    // (allowance 0) is ignored.
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
    expect(m("m1").sharers).toBe(6);
    expect(m("m1").carSharePerSharer).toBe(84);
    expect(m("m2").share).toBe(273); // CEIL(3000/11)
    expect(m("m3").share).toBe(300); // 3000/10 exact
    expect(m("m3").sharers).toBe(4);
    expect(m("m3").carSharePerSharer).toBe(75);
    expect(m("m4").share).toBe(375); // 3000/8 exact
    expect(m("m5").share).toBe(334); // CEIL(3000/9)

    const rowOf = (id: string) => result.rows.find((r) => r.playerId === id);
    // Same player, different rate per match: p11 played m1 and m2 only.
    expect(rowOf(p(11))?.charge).toBe(250 + 273);
    expect(rowOf(p(12))?.charge).toBe(250);
    // All five base shares = 250+273+300+375+334 = 1532. p7 just
    // played; p4 rode in m1 and m3; p1 drove in m1; p3 rode in m1 and
    // drove in m3.
    expect(rowOf(p(7))?.charge).toBe(1532);
    expect(rowOf(p(4))?.charge).toBe(1532 + 84 + 75);
    expect(rowOf(p(1))?.charge).toBe(1532 + 84 - 250);
    expect(rowOf(p(3))?.charge).toBe(1532 + 84 + 75 - 300);

    // Base ceils give 9; m1's car ceil gives 6×84 − 500 = 4 more.
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
    // fee 0; one match, big allowance, both passengers shared: the
    // 300 splits three ways (driver included), the driver nets −200.
    const result = calculateTournamentFees({
      joiningFee: 0,
      matches: [match("m1", ["a", "b", "c"], ["a"], 300, ["b", "c"])],
    });
    expect(result.matches[0].share).toBe(0);
    expect(result.matches[0].sharers).toBe(3);
    expect(result.matches[0].carSharePerSharer).toBe(100);
    const rowOf = (id: string) => result.rows.find((r) => r.playerId === id);
    expect(rowOf("a")?.charge).toBe(-200);
    expect(rowOf("b")?.charge).toBe(100);
    expect(rowOf("c")?.charge).toBe(100);
    expect(result.collected).toBe(0);
    expect(result.surplus).toBe(0);
    expectInvariants(result, 0);
  });

  it("redistributes car money within each match only (fee 0)", () => {
    // m1: a drives @100, b rides → 50 each, a nets −50.
    // m2: b drives @90, a and c ride → 30 each, b nets −60 that match.
    const result = calculateTournamentFees({
      joiningFee: 0,
      matches: [
        match("m1", ["a", "b"], ["a"], 100, ["b"]),
        match("m2", ["a", "b", "c"], ["b"], 90, ["a", "c"]),
      ],
    });
    const rowOf = (id: string) => result.rows.find((r) => r.playerId === id);
    expect(rowOf("a")?.charge).toBe(-50 + 30);
    expect(rowOf("b")?.charge).toBe(50 - 60);
    expect(rowOf("c")?.charge).toBe(30);
    expect(result.surplus).toBe(0);
    expectInvariants(result, 0);
  });

  it("a driver who carried nobody pays their own car money and gets it back — nets the base share", () => {
    const result = calculateTournamentFees({
      joiningFee: 300,
      matches: [match("m1", ["a", "b", "c"], ["a"], 100)],
    });
    expect(result.matches[0].sharers).toBe(1);
    expect(result.matches[0].carSharePerSharer).toBe(100);
    const a = result.rows.find((r) => r.playerId === "a")!;
    expect(a.driverCredit).toBe(100);
    expect(result.lines.find((l) => l.playerId === "a")?.share).toBe(200);
    expect(result.rows.every((r) => r.charge === 100)).toBe(true);
    expect(result.surplus).toBe(0);
    expectInvariants(result, 300);
  });

  it("ticking a driver as shared changes nothing — a driver is always a sharer", () => {
    const ticked = calculateTournamentFees({
      joiningFee: 0,
      matches: [match("m1", ["a", "b"], ["a"], 100, ["a", "b"])],
    });
    const unticked = calculateTournamentFees({
      joiningFee: 0,
      matches: [match("m1", ["a", "b"], ["a"], 100, ["b"])],
    });
    expect(ticked).toEqual(unticked);
    expect(ticked.matches[0].sharers).toBe(2);
    expect(ticked.rows.find((r) => r.playerId === "a")?.charge).toBe(-50);
    expect(ticked.rows.find((r) => r.playerId === "b")?.charge).toBe(50);
    expectInvariants(ticked, 0);
  });

  it("stacks the car share on the base share for one match", () => {
    // fee 1000 / 3 → base 334 each; b rode with a → 100 split 2 ways:
    // a 334 + 50 − 100 = 284, b 384, c (own way) 334.
    const result = calculateTournamentFees({
      joiningFee: 1000,
      matches: [match("m1", ["a", "b", "c"], ["a"], 100, ["b"])],
    });
    expect(result.matches[0].share).toBe(334); // CEIL(1000/3)
    expect(result.matches[0].carSharePerSharer).toBe(50);
    const rowOf = (id: string) => result.rows.find((r) => r.playerId === id);
    expect(rowOf("a")?.charge).toBe(284);
    expect(rowOf("b")?.charge).toBe(384);
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
