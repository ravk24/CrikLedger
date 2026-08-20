import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays, Home, LayoutGrid, Trophy, Wallet } from "lucide-react";
import { buildTabs, getNavState } from "@/lib/nav";
import { AppTabBar } from "./AppTabBar";

async function Gate() {
  // Reads the session again: tab ORDER depends on entitlement (Schedule
  // leads for a visitor, Home for a Ledger holder). Legal here and only
  // here — the <Suspense> below is the boundary getNavState() requires.
  const nav = await getNavState();
  return <AppTabBar tabs={buildTabs(nav)} />;
}

// Static placeholder for the prerendered shell — same five slots, same
// geometry, but NO hooks. usePathname() is runtime data under Cache
// Components, so the real bar (which needs it for the active state)
// cannot appear in the static shell at all.
//
// Every href here is state-independent, so all five can be real links.
// The shell cannot read cookies, so it has to commit to ONE order and
// shows the visitor's (Schedule first) — first paint is overwhelmingly
// people who have not bought anything. A Ledger holder may therefore see
// the first two tabs swap once the streamed bar arrives; that is the
// accepted cost of ordering by entitlement, and no other tab moves.
function AppTabBarShell() {
  const tabs = [
    { label: "Schedule", icon: CalendarDays, href: "/schedule" },
    { label: "Home", icon: Home, href: "/" },
    { label: "Tournament", icon: Trophy, href: "/tournaments" },
    { label: "Ledger", icon: Wallet, href: "/pool" },
    { label: "More", icon: LayoutGrid, href: "/more" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom))] z-10 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-md">
        {tabs.map(({ label, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-text-muted"
          >
            <Icon size={20} strokeWidth={2} />
            <span className="whitespace-nowrap text-center text-[11px] font-semibold leading-tight">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

// Hosted by the (app) route group layout: layouts survive sibling
// navigation, so this fallback shows on first load only, never on a
// tab tap.
export function AppTabBarGate() {
  return (
    <Suspense fallback={<AppTabBarShell />}>
      <Gate />
    </Suspense>
  );
}
