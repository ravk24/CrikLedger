import { describe, expect, it } from "vitest";
import { activeGrounds, findGround, groundKey, type TeamGround } from "./grounds";

const grounds: TeamGround[] = [
  { id: "g1", name: "Barne, Pusane", car_allowance: 250, is_active: true },
  { id: "g2", name: "MCG", car_allowance: 50, is_active: true },
  { id: "g3", name: "Old Ground", car_allowance: 100, is_active: false },
];

describe("findGround", () => {
  it("matches a venue to a preset by name, ignoring case and padding", () => {
    expect(findGround(grounds, "mcg")?.id).toBe("g2");
    expect(findGround(grounds, "  Barne, Pusane ")?.id).toBe("g1");
  });

  it("returns null for a venue with no preset, an empty venue, or no venue", () => {
    expect(findGround(grounds, "CSMCC")).toBeNull();
    expect(findGround(grounds, "   ")).toBeNull();
    expect(findGround(grounds, "")).toBeNull();
    expect(findGround(grounds, null)).toBeNull();
    expect(findGround(grounds, undefined)).toBeNull();
  });

  it("never matches a hidden ground", () => {
    expect(findGround(grounds, "Old Ground")).toBeNull();
  });

  it("groundKey is what the DB's unique index uses: lower(btrim(name))", () => {
    expect(groundKey("  Lords Mawal ")).toBe("lords mawal");
  });

  it("activeGrounds keeps only the visible presets", () => {
    expect(activeGrounds(grounds).map((g) => g.id)).toEqual(["g1", "g2"]);
  });
});
