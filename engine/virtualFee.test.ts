import { describe, expect, it } from "vitest";
import { virtualFee } from "./virtualFee";

const CHARGES = [200, 200, 150, 75, 35];

describe("virtualFee", () => {
  it("throws when the fee is below the occupied positions' fixed charges", () => {
    expect(() =>
      virtualFee({
        matchFee: 500,
        overs: 10,
        positionCharges: CHARGES,
        batsmen: [
          { name: "a", ballsFaced: 10 },
          { name: "b", ballsFaced: 10 },
          { name: "c", ballsFaced: 10 },
          { name: "d", ballsFaced: 10 },
          { name: "e", ballsFaced: 10 },
        ], // fixed total 660 > 500
        bowlers: [],
      }),
    ).toThrow("FEE_BELOW_FIXED");
  });

  it("splits a fee at exactly the fixed total (zero pools, no negatives)", () => {
    const result = virtualFee({
      matchFee: 400,
      overs: 10,
      positionCharges: CHARGES,
      batsmen: [
        { name: "a", ballsFaced: 30 },
        { name: "b", ballsFaced: 30 },
      ], // fixed total 400
      bowlers: [{ name: "c", ballsBowled: 60 }],
    });
    for (const t of result.totals) {
      expect(t.amount).toBeGreaterThanOrEqual(0);
    }
  });
});
