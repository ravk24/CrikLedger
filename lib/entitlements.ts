import { isMegaadmin, type Principal } from "@/lib/roles";

// Entitlement = what an account has PAID for. Since migration 37 this is
// a real table (one row per purchase, scoped to a team), written only by
// the operator console's grant flow (app/api/ops/grants) and read into
// the session alongside memberships (lib/session.ts). The summaries ride
// the Principal so every gating decision stays a pure function of the
// session — no call site touches the table.
//
// Every gating decision in the app goes through here. Do not inline
// membership or entitlement checks at call sites for gating purposes.
//
// Note this is about ENTITLEMENT (may this account use the product),
// never about AUTHORIZATION (may it touch this row). Authorization is
// lib/roles.ts, and it is the one that must be enforced server-side in
// write routes — greyed-out UI is cosmetic (roadmap invariant 10).

export type Product = "team_ledger" | "tournament_credit";

export type EntitlementAccount = Pick<
  Principal,
  "platformRole" | "memberships" | "entitlements"
> & {
  activeTeamId?: string | null;
};

function principalOf(account: EntitlementAccount): Principal {
  return {
    id: "",
    platformRole: account.platformRole,
    memberships: account.memberships,
    entitlements: account.entitlements,
  };
}

export function hasEntitlement(
  account: EntitlementAccount | null,
  product: Product,
): boolean {
  if (!account) return false;
  const principal = principalOf(account);
  const rows = account.entitlements ?? [];

  switch (product) {
    case "team_ledger":
      // The megaadmin owns nothing, but must be able to open a team's app
      // to reproduce what a user reports — read-only, per lib/roles.ts.
      if (isMegaadmin(principal)) return !!account.activeTeamId;
      // Any member team with a Ledger — an admin on a paid team holds
      // the product through that membership, and the tab bar must not
      // flip when they switch to a team that has none.
      return rows.some((e) => e.product === "team_ledger" && e.total > 0);

    case "tournament_credit":
      if (isMegaadmin(principal)) return true;
      // The ACTIVE team: used or unused — a team that has run a
      // tournament keeps seeing it after the credit is spent.
      return rows.some(
        (e) =>
          e.product === "tournament_credit" &&
          e.teamId === account.activeTeamId &&
          e.total > 0,
      );
  }
}

// Unused credits on the active team — what "Create tournament" needs.
// The megaadmin is read-only and cannot create, so it reports 0.
export function tournamentCreditsLeft(
  account: EntitlementAccount | null,
): number {
  if (!account || !account.activeTeamId) return 0;
  if (isMegaadmin(principalOf(account))) return 0;
  return (account.entitlements ?? [])
    .filter(
      (e) =>
        e.product === "tournament_credit" && e.teamId === account.activeTeamId,
    )
    .reduce((sum, e) => sum + e.unused, 0);
}
