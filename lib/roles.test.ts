import { describe, expect, it } from "vitest";
import {
  canAdminister,
  canRead,
  canWrite,
  isEpochValid,
  isMegaadmin,
  isScopeSuperadmin,
  isViewer,
  resolveActiveTeamId,
  scopeRoleFor,
  type Membership,
  type Principal,
} from "./roles";

const TEAM_A = "11111111-1111-1111-1111-111111111111";
const TEAM_B = "22222222-2222-2222-2222-222222222222";
const TOURNEY = "33333333-3333-3333-3333-333333333333";

const teamMembership = (
  id: string,
  slug: string,
  role: Membership["role"],
): Membership => ({ kind: "team", id, slug, name: slug, role });

const principal = (
  memberships: Membership[],
  platformRole: Principal["platformRole"] = "user",
): Principal => ({ id: "acct", platformRole, memberships });

// Owns team A, helps out on team B — the cross-team case the whole
// membership model exists for.
const owner = principal([
  teamMembership(TEAM_A, "alpha", "superadmin"),
  teamMembership(TEAM_B, "bravo", "admin"),
]);

const megaadmin = principal([], "megaadmin");
const stranger = principal([]);

describe("scopeRoleFor", () => {
  it("returns the explicit role held in each scope", () => {
    expect(scopeRoleFor(owner, "team", TEAM_A)).toBe("superadmin");
    expect(scopeRoleFor(owner, "team", TEAM_B)).toBe("admin");
  });

  it("returns null for a scope with no membership row", () => {
    expect(scopeRoleFor(owner, "team", TOURNEY)).toBeNull();
    expect(scopeRoleFor(stranger, "team", TEAM_A)).toBeNull();
  });

  it("does not confuse a team scope with a tournament of the same id", () => {
    const p = principal([
      { kind: "tournament", id: TOURNEY, slug: TOURNEY, name: "cup", role: "superadmin" },
    ]);
    expect(scopeRoleFor(p, "tournament", TOURNEY)).toBe("superadmin");
    expect(scopeRoleFor(p, "team", TOURNEY)).toBeNull();
  });

  it("stays blind to megaadmin — it reports grants, not powers", () => {
    expect(scopeRoleFor(megaadmin, "team", TEAM_A)).toBeNull();
  });

  it("returns null for a null principal or a null scope", () => {
    expect(scopeRoleFor(null, "team", TEAM_A)).toBeNull();
    expect(scopeRoleFor(owner, "team", null)).toBeNull();
  });
});

describe("canRead", () => {
  it("allows members of the scope", () => {
    expect(canRead(owner, "team", TEAM_A)).toBe(true);
    expect(canRead(owner, "team", TEAM_B)).toBe(true);
  });

  it("refuses non-members and anonymous visitors", () => {
    expect(canRead(stranger, "team", TEAM_A)).toBe(false);
    expect(canRead(null, "team", TEAM_A)).toBe(false);
  });

  it("allows the megaadmin into any scope, with no membership row", () => {
    expect(canRead(megaadmin, "team", TEAM_A)).toBe(true);
    expect(canRead(megaadmin, "tournament", TOURNEY)).toBe(true);
  });
});

describe("canWrite", () => {
  it("allows members of the scope", () => {
    expect(canWrite(owner, "team", TEAM_A)).toBe(true);
    expect(canWrite(owner, "team", TEAM_B)).toBe(true);
  });

  it("refuses non-members and anonymous visitors", () => {
    expect(canWrite(stranger, "team", TEAM_A)).toBe(false);
    expect(canWrite(null, "team", TEAM_A)).toBe(false);
  });

  // The load-bearing invariant: observer, not operator.
  it("REFUSES the megaadmin everywhere, including scopes it can read", () => {
    expect(canRead(megaadmin, "team", TEAM_A)).toBe(true);
    expect(canWrite(megaadmin, "team", TEAM_A)).toBe(false);
    expect(canWrite(megaadmin, "tournament", TOURNEY)).toBe(false);
  });

  it("refuses the megaadmin even if a stray membership row exists", () => {
    const contaminated = principal(
      [teamMembership(TEAM_A, "alpha", "superadmin")],
      "megaadmin",
    );
    expect(canWrite(contaminated, "team", TEAM_A)).toBe(false);
  });
});

describe("canAdminister", () => {
  it("is granted to the scope's superadmin only", () => {
    expect(canAdminister(owner, "team", TEAM_A)).toBe(true);
    expect(canAdminister(owner, "team", TEAM_B)).toBe(false); // admin, not superadmin
  });

  it("is refused to the megaadmin", () => {
    expect(canAdminister(megaadmin, "team", TEAM_A)).toBe(false);
  });
});

describe("resolveActiveTeamId", () => {
  it("honours a cookie slug matching a membership", () => {
    expect(resolveActiveTeamId(owner, "bravo")).toBe(TEAM_B);
  });

  it("falls back to the first membership when the cookie is absent", () => {
    expect(resolveActiveTeamId(owner, null)).toBe(TEAM_A);
  });

  it("ignores a stale or forged slug rather than failing", () => {
    expect(resolveActiveTeamId(owner, "not-a-team")).toBe(TEAM_A);
  });

  it("returns null when the account holds no team memberships", () => {
    expect(resolveActiveTeamId(stranger, "alpha")).toBeNull();
    expect(resolveActiveTeamId(null, "alpha")).toBeNull();
  });

  it("lets a megaadmin observe a team it has no membership in", () => {
    const known = new Map([["alpha", TEAM_A]]);
    expect(resolveActiveTeamId(megaadmin, "alpha", known)).toBe(TEAM_A);
  });

  it("returns null for a megaadmin pointing at a team that does not exist", () => {
    expect(resolveActiveTeamId(megaadmin, "ghost", new Map())).toBeNull();
  });

  it("does not let an ordinary user borrow the known-teams map", () => {
    const known = new Map([["ghost", "ghost-id"]]);
    expect(resolveActiveTeamId(owner, "ghost", known)).toBe(TEAM_A);
  });

  it("ignores tournament memberships when picking a team", () => {
    const p = principal([
      { kind: "tournament", id: TOURNEY, slug: TOURNEY, name: "cup", role: "superadmin" },
    ]);
    expect(resolveActiveTeamId(p, null)).toBeNull();
  });
});

describe("isEpochValid", () => {
  it("accepts an exact match", () => {
    expect(isEpochValid(3, 3)).toBe(true);
  });

  it("rejects a stale token after logout or a password change", () => {
    expect(isEpochValid(2, 3)).toBe(false);
  });

  it("rejects a token minted before the epoch existed", () => {
    expect(isEpochValid(undefined, 1)).toBe(false);
    expect(isEpochValid(null, 1)).toBe(false);
  });

  it("rejects non-integer claims", () => {
    expect(isEpochValid("1", 1)).toBe(false);
    expect(isEpochValid(1.5, 1)).toBe(false);
    expect(isEpochValid(NaN, 1)).toBe(false);
  });
});

describe("megaadmin vs ordinary account", () => {
  // A megaadmin holding a membership row is refused by the membership
  // routes themselves and surfaced by the /ops "stray" counter; there is
  // no separate predicate to test any more.
  it("tells the platform account from an ordinary owner", () => {
    expect(isMegaadmin(megaadmin)).toBe(true);
    expect(isMegaadmin(owner)).toBe(false);
    expect(isScopeSuperadmin(owner, "team", TEAM_A)).toBe(true);
  });
});

// The shared team-viewer login (migration 49): a membership row whose
// role is 'viewer'. It reads like a member and writes like a stranger.
// canWrite used to grant ANY membership row — the load-bearing case here
// is that it now consults the role.
describe("viewer role", () => {
  const viewer = principal([teamMembership(TEAM_A, "alpha", "viewer")]);
  // Admin on one team, viewer on another — allowed by the model even
  // though the viewer routes never create it.
  const mixed = principal([
    teamMembership(TEAM_A, "alpha", "admin"),
    teamMembership(TEAM_B, "bravo", "viewer"),
  ]);

  it("is reported as the explicit role held", () => {
    expect(scopeRoleFor(viewer, "team", TEAM_A)).toBe("viewer");
    expect(scopeRoleFor(viewer, "team", TEAM_B)).toBeNull();
  });

  it("reads its own team and nothing else", () => {
    expect(canRead(viewer, "team", TEAM_A)).toBe(true);
    expect(canRead(viewer, "team", TEAM_B)).toBe(false);
  });

  it("never writes, even where it is a member", () => {
    expect(canWrite(viewer, "team", TEAM_A)).toBe(false);
    expect(canAdminister(viewer, "team", TEAM_A)).toBe(false);
  });

  it("is refused per scope, not per account", () => {
    expect(canWrite(mixed, "team", TEAM_A)).toBe(true);
    expect(canWrite(mixed, "team", TEAM_B)).toBe(false);
    expect(canRead(mixed, "team", TEAM_B)).toBe(true);
  });

  it("isViewer is true only for a pure viewer account", () => {
    expect(isViewer(viewer)).toBe(true);
    expect(isViewer(mixed)).toBe(false);
    expect(isViewer(owner)).toBe(false);
    expect(isViewer(stranger)).toBe(false);
    expect(isViewer(megaadmin)).toBe(false);
    expect(isViewer(null)).toBe(false);
  });

  it("resolves its one team as the active team", () => {
    expect(resolveActiveTeamId(viewer, null)).toBe(TEAM_A);
    expect(resolveActiveTeamId(viewer, "alpha")).toBe(TEAM_A);
    expect(resolveActiveTeamId(viewer, "forged")).toBe(TEAM_A);
  });

  it("keeps the megaadmin refused even with a stray viewer row", () => {
    const strayMega = principal(
      [teamMembership(TEAM_A, "alpha", "viewer")],
      "megaadmin",
    );
    expect(canWrite(strayMega, "team", TEAM_A)).toBe(false);
    expect(isViewer(strayMega)).toBe(false);
  });
});
