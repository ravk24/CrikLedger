import { describe, expect, it } from "vitest";
import { formatFee } from "./format";

describe("formatFee", () => {
  it("prints what a person pays", () => {
    expect(formatFee(5)).toBe("₹5");
    expect(formatFee(0)).toBe("₹0");
    expect(formatFee(2565)).toBe("₹2,565");
  });

  it("prints a credit as 'gets', never as a bare sign", () => {
    expect(formatFee(-53)).toBe("gets ₹53");
    expect(formatFee(-36)).toBe("gets ₹36");
  });
});
