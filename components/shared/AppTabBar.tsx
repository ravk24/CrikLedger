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
    <nav className="fixed inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom))] z-10 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const Icon = ICONS[tab.icon];
          const className =
            "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2";

          if (!tab.href) {
            return (
              <div
                // Keyed by SLOT, not label or href: the slot is the
                // stable identity of a position in the bar, and a label
                // or href is free to change with entitlement.
                key={tab.slot}
                aria-disabled="true"
                className={cn(className, "text-text-muted opacity-50")}
              >
                <Icon size={20} strokeWidth={2} />
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
                active ? "text-accent" : "text-text-muted",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 2} />
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
