import {
  isMegaadmin,
  teamMemberships,
  tournamentMemberships,
  type Principal,
} from "@/lib/roles";

// THE Feature 3 swap point.
//
// Entitlements (what an account has PAID for) do not exist yet — the
// products/payments/entitlements tables are Feature 3 and the grant path
// is Feature 5. Until then, ownership is inferred from memberships:
// holding a superadmin membership is the only way a scope exists, and
// scopes are only created by a purchase.
//
// Every gating decision in the app goes through this one function, so
// when Feature 3 lands it replaces THIS BODY and nothing else changes.
// Do not inline membership checks at call sites for gating purposes —
// that is what would make the swap a rewrite instead of an edit.
//
// Note this is about ENTITLEMENT (may this account use the product),
// never about AUTHORIZATION (may it touch this row). Authorization is
// lib/roles.ts, and it is the one that must be enforced server-side in
// write routes — greyed-out UI is cosmetic (roadmap invariant 10).

export type Product = "team_ledger" | "tournament_credit";

export type EntitlementAccount = Pick<
  Principal,
  "platformRole" | "memberships"
> & {
  activeTeamId?: string | null;
};

export function hasEntitlement(
  account: EntitlementAccount | null,
  product: Product,
): boolean {
  if (!account) return false;

  const principal: Principal = {
    id: "",
    platformRole: account.platformRole,
    memberships: account.memberships,
  };

  switch (product) {
    case "team_ledger":
      // The megaadmin owns nothing, but must be able to open a team's app
      // to reproduce what a user reports — read-only, per lib/roles.ts.
      if (isMegaadmin(principal)) return !!account.activeTeamId;
      return teamMemberships(principal).length > 0;

    case "tournament_credit":
      if (isMegaadmin(principal)) return true;
      // A tournament membership, or a team (today every tournament is
      // hosted by a team; standalone tournaments arrive with Feature 5).
      return (
        tournamentMemberships(principal).length > 0 ||
        teamMemberships(principal).length > 0
      );
  }
}
