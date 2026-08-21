import { describe, expect, it } from "vitest";
import { hasEntitlement, tournamentCreditsLeft } from "./entitlements";
import type { EntitlementSummary, Membership } from "./roles";

const teamA: Membership = {
  kind: "team",
  id: "team-a",
  slug: "team-a",
  name: "Team A",
  role: "superadmin",
};
const teamB: Membership = { ...teamA, id: "team-b", slug: "team-b", name: "Team B", role: "admin" };

const ledgerA: EntitlementSummary = { teamId: "team-a", product: "team_ledger", total: 1, unused: 1 };
const creditsB = (total: number, unused: number): EntitlementSummary => ({
  teamId: "team-b",
  product: "tournament_credit",
  total,
  unused,
});

function user(
  memberships: Membership[],
  entitlements: EntitlementSummary[],
  activeTeamId: string | null,
) {
  return { platformRole: "user" as const, memberships, entitlements, activeTeamId };
}

describe("hasEntitlement", () => {
  it("is false for nobody", () => {
    expect(hasEntitlement(null, "team_ledger")).toBe(false);
  });

  it("membership alone no longer grants anything", () => {
    const a = user([teamA], [], "team-a");
    expect(hasEntitlement(a, "team_ledger")).toBe(false);
    expect(hasEntitlement(a, "tournament_credit")).toBe(false);
  });

  it("Ledger follows ANY member team, regardless of the active one", () => {
    const a = user([teamA, teamB], [ledgerA], "team-b");
    expect(hasEntitlement(a, "team_ledger")).toBe(true);
  });

  it("tournament credit follows the ACTIVE team only, spent or not", () => {
    const spent = user([teamA, teamB], [creditsB(1, 0)], "team-b");
    expect(hasEntitlement(spent, "tournament_credit")).toBe(true);
    const other = user([teamA, teamB], [creditsB(1, 0)], "team-a");
    expect(hasEntitlement(other, "tournament_credit")).toBe(false);
  });

  it("megaadmin: Ledger only while observing a team, tournaments always", () => {
    const mega = {
      platformRole: "megaadmin" as const,
      memberships: [],
      entitlements: [],
      activeTeamId: null,
    };
    expect(hasEntitlement(mega, "team_ledger")).toBe(false);
    expect(hasEntitlement({ ...mega, activeTeamId: "team-a" }, "team_ledger")).toBe(true);
    expect(hasEntitlement(mega, "tournament_credit")).toBe(true);
  });
});

describe("tournamentCreditsLeft", () => {
  it("counts unused credits on the active team", () => {
    expect(tournamentCreditsLeft(user([teamB], [creditsB(3, 2)], "team-b"))).toBe(2);
    expect(tournamentCreditsLeft(user([teamB], [creditsB(3, 2)], "team-a"))).toBe(0);
    expect(tournamentCreditsLeft(null)).toBe(0);
  });

  it("the read-only megaadmin never has credits to spend", () => {
    const mega = {
      platformRole: "megaadmin" as const,
      memberships: [],
      entitlements: [creditsB(1, 1)],
      activeTeamId: "team-b",
    };
    expect(tournamentCreditsLeft(mega)).toBe(0);
  });
});
