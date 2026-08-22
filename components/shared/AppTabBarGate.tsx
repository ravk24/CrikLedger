import { Suspense } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CHROME_BAR, CHROME_TAB, CHROME_TAB_ICON } from "@/lib/ui";
import { CalendarDays, Home, LayoutGrid, Trophy, Wallet } from "lucide-react";
import { buildTabs } from "@/lib/nav";
import { AppTabBar } from "./AppTabBar";

function Gate() {
  // No session read — the tab set, order included, is the same for
  // everyone. The boundary below is still required: AppTabBar calls
  // usePathname(), which is runtime data under Cache Components.
  return <AppTabBar tabs={buildTabs()} />;
}

// Static placeholder for the prerendered shell — same five slots, same
// geometry, but NO hooks. usePathname() is runtime data under Cache
// Components, so the real bar (which needs it for the active state)
// cannot appear in the static shell at all.
//
// Every href here is state-independent, so all five can be real links,
// and neither the labels nor the order move: this shell is identical to
// the streamed bar in every state except the active-tab highlight.
function AppTabBarShell() {
  const tabs = [
    { label: "Home", icon: Home, href: "/" },
    { label: "Schedule", icon: CalendarDays, href: "/schedule" },
    { label: "Tournament", icon: Trophy, href: "/tournaments" },
    { label: "Ledger", icon: Wallet, href: "/pool" },
    { label: "More", icon: LayoutGrid, href: "/more" },
  ];

  return (
    <nav className={CHROME_BAR}>
      <div className="mx-auto flex max-w-md">
        {tabs.map(({ label, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className={cn(CHROME_TAB, "text-chrome-muted")}
          >
            <span className={CHROME_TAB_ICON}>
              <Icon size={20} strokeWidth={2} />
            </span>
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
