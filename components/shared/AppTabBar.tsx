"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Home,
  LayoutGrid,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHROME_BAR,
  CHROME_TAB,
  CHROME_TAB_ICON,
  CHROME_TAB_ICON_ACTIVE,
} from "@/lib/ui";
import type { IconKey, TabSpec } from "@/lib/nav";

// The key -> component map lives HERE, on the client. TabSpec carries an
// IconKey string because a lucide component reference cannot cross the
// server/client boundary — passing one from the gate would fail at
// runtime, and it is the easiest mistake to make in this file.
const ICONS: Record<IconKey, LucideIcon> = {
  home: Home,
  calendar: CalendarDays,
  trophy: Trophy,
  wallet: Wallet,
  grid: LayoutGrid,
};

// Five flex-1 tabs share ~380px — labels must stay short enough not to
// wrap. A tab with href: null renders greyed and inert rather than
// disappearing: the bar is always five slots, so nothing shifts sideways
// when a purchase enables a tab.
export function AppTabBar({ tabs }: { tabs: TabSpec[] }) {
  const pathname = usePathname();

  return (
    <nav className={CHROME_BAR}>
      <div className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const Icon = ICONS[tab.icon];
          const className = CHROME_TAB;

          if (!tab.href) {
            return (
              <div
                // Keyed by SLOT, not label or href: the slot is the
                // stable identity of a position in the bar, and a label
                // or href is free to change with entitlement.
                key={tab.slot}
                aria-disabled="true"
                className={cn(className, "text-chrome-muted opacity-40")}
              >
                <span className={CHROME_TAB_ICON}>
                  <Icon size={20} strokeWidth={2} />
                </span>
                <span className="whitespace-nowrap text-center text-[11px] font-semibold leading-tight">
                  {tab.label}
                </span>
              </div>
            );
          }

          const active = tab.exact
            ? pathname === tab.href
            : [tab.href, ...(tab.also ?? [])].some((p) =>
                pathname.startsWith(p),
              );

          return (
            <Link
              key={tab.slot}
              href={tab.href}
              className={cn(
                className,
                active ? "text-chrome-accent" : "text-chrome-muted",
              )}
            >
              <span
                className={cn(CHROME_TAB_ICON, active && CHROME_TAB_ICON_ACTIVE)}
              >
                <Icon size={20} strokeWidth={active ? 2.25 : 2} />
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-center text-[11px] leading-tight",
                  active ? "font-bold" : "font-semibold",
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
