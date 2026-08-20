import { hasEntitlement } from "@/lib/entitlements";
import { isMegaadmin, teamMemberships, type Membership } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";

// The adaptive 5-tab bar's state machine, kept pure and separate from
// the components so it can be reasoned about (and later tested) without
// React. getNavState() reads cookies, so it may only ever be called
// INSIDE a <Suspense> boundary — see components/shared/AppTabBarGate.

export type TabSlot = "primary" | "schedule" | "tournament" | "ledger" | "more";

// Icons cross the server/client boundary as STRING KEYS. A lucide
// component reference is not serializable, and passing one from the
// server gate to the client bar fails at runtime — the client component
// owns the key -> component map.
export type IconKey = "home" | "calendar" | "trophy" | "wallet" | "grid";

export type TabSpec = {
  slot: TabSlot;
  label: string;
  href: string | null; // null = present but greyed and inert
  icon: IconKey;
  exact?: boolean;
  also?: string[]; // child routes that keep this tab highlighted
};

export type NavState = {
  signedIn: boolean;
  accountId: string | null;
  accountName: string | null;
  isMegaadmin: boolean;
  mustChangePassword: boolean;
  hasTeamLedger: boolean;
  hasTournamentCredit: boolean;
  teams: Membership[];
  activeTeamId: string | null;
  activeTeamName: string | null;
};

export const GUEST_NAV: NavState = {
  signedIn: false,
  accountId: null,
  accountName: null,
  isMegaadmin: false,
  mustChangePassword: false,
  hasTeamLedger: false,
  hasTournamentCredit: false,
  teams: [],
  activeTeamId: null,
  activeTeamName: null,
};

export async function getNavState(): Promise<NavState> {
  const admin = await getSessionAdmin();
  if (!admin) return GUEST_NAV;

  const teams = teamMemberships(admin);
  return {
    signedIn: true,
    accountId: admin.id,
    accountName: admin.name,
    isMegaadmin: isMegaadmin(admin),
    mustChangePassword: admin.mustChangePassword,
    hasTeamLedger: hasEntitlement(admin, "team_ledger"),
    hasTournamentCredit: hasEntitlement(admin, "tournament_credit"),
    teams,
    activeTeamId: admin.activeTeamId,
    activeTeamName:
      teams.find((t) => t.id === admin.activeTeamId)?.name ?? null,
  };
}

// More's `also` list: every page that lives behind the More drawer, so
// the tab stays highlighted while you are down there.
const MORE_ALSO = [
  "/matches",
  "/car-fee",
  "/car-count",
  "/virtual-fee",
  "/about-us",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/return-policy",
  "/shipping-policy",
  "/disclaimer",
  "/pricing",
  "/purchases",
  "/install",
];

/**
 * The five tabs for a given state. Nothing is ever hidden — an
 * unavailable tab keeps its slot and renders greyed and inert
 * (href: null), which is the app-wide disabled-not-hidden rule.
 *
 * ORDER is the one thing entitlement changes. Without a Team Ledger the
 * Schedule tab leads with the free sample match, which is the whole
 * pitch, so it takes first position and Home (the shop window) follows.
 * A Ledger holder gets Home — their team dashboard — first, as before.
 *
 * Nothing else moves: every label, href and icon is identical in both
 * orders. That is what keeps bookmarks, the manifest start_url and the
 * pathname-driven active-tab test working, and it means the reorder is a
 * key-preserving move rather than a re-render (keys are tab.slot).
 */
export function buildTabs(nav: NavState): TabSpec[] {
  const home: TabSpec = {
    slot: "primary",
    label: "Home",
    href: "/",
    icon: "home",
    exact: true,
  };
  const schedule: TabSpec = {
    slot: "schedule",
    label: "Schedule",
    href: "/schedule",
    icon: "calendar",
    also: ["/slots", "/other-slots"],
  };

  return [
    ...(nav.hasTeamLedger ? [home, schedule] : [schedule, home]),
    // Always navigable: a guest must be able to open the directory to
    // see what is on offer. What a purchase unlocks is HOSTING, inside.
    {
      slot: "tournament",
      label: "Tournament",
      href: "/tournaments",
      icon: "trophy",
    },
    // The guest ledger is a static sample, so the tab is live for
    // everyone; only a real team's ledger needs the entitlement.
    { slot: "ledger", label: "Ledger", href: "/pool", icon: "wallet" },
    {
      slot: "more",
      label: "More",
      href: "/more",
      icon: "grid",
      also: MORE_ALSO,
    },
  ];
}
