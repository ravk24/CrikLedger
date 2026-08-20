import { describe, expect, it } from "vitest";
import { buildTabs } from "./nav";

// Nothing else in the app asserts tab order, and two things quietly
// depend on it: the static prerender shell in AppTabBarGate hardcodes
// the same five tabs in the same order, and Home at slot 0 is what the
// manifest start_url and every bookmark land on.
//
// Ordering the tabs by entitlement was tried and reverted, so the order
// being state-independent is the property worth pinning.

describe("tab bar", () => {
  it("is Home, Schedule, Tournament, Ledger, More — for everyone", () => {
    expect(buildTabs().map((t) => t.slot)).toEqual([
      "primary",
      "schedule",
      "tournament",
      "ledger",
      "more",
    ]);
  });

  it("opens on Home at /, matched exactly", () => {
    const [first] = buildTabs();
    expect(first).toMatchObject({ label: "Home", href: "/", exact: true });
  });

  it("keeps every tab navigable", () => {
    expect(buildTabs().every((t) => t.href !== null)).toBe(true);
  });
});
