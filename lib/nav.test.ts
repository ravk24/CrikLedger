import { describe, expect, it } from "vitest";
import { buildTabs, GUEST_NAV, type NavState } from "./nav";

// Tab ORDER is the one thing entitlement changes, and it is the kind of
// thing that silently regresses: the static prerender shell in
// AppTabBarGate hardcodes the visitor order, and nothing else in the app
// asserts either arrangement.

const LEDGER_HOLDER: NavState = { ...GUEST_NAV, signedIn: true, hasTeamLedger: true };

const slots = (nav: NavState) => buildTabs(nav).map((t) => t.slot);

describe("tab order", () => {
  it("leads with Schedule for a visitor without a Ledger", () => {
    expect(slots(GUEST_NAV)).toEqual([
      "schedule",
      "primary",
      "tournament",
      "ledger",
      "more",
    ]);
  });

  it("leads with Home for a Ledger holder", () => {
    expect(slots(LEDGER_HOLDER)).toEqual([
      "primary",
      "schedule",
      "tournament",
      "ledger",
      "more",
    ]);
  });

  it("changes nothing but the order — same hrefs, labels and icons", () => {
    const byslot = (nav: NavState) =>
      Object.fromEntries(
        buildTabs(nav).map((t) => [t.slot, `${t.label}|${t.href}|${t.icon}`]),
      );
    expect(byslot(GUEST_NAV)).toEqual(byslot(LEDGER_HOLDER));
  });

  it("keeps every tab navigable in both states", () => {
    for (const nav of [GUEST_NAV, LEDGER_HOLDER]) {
      expect(buildTabs(nav).every((t) => t.href !== null)).toBe(true);
    }
  });
});
