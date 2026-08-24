"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Settings, Undo2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  isAdmin: boolean; // admin tab renders only for admins
};

// Per-tournament bottom navigation — the tournament mini-app's TabBar.
// The Tournaments tab leaves the mini-app for /tournaments; Admin
// renders disabled (not hidden) for non-admins so the bar is always
// 5 slots and Admin stays centered with no post-stream layout jump.
// The tournament id comes from the pathname, not a server prop — under
// Cache Components a params-derived prop would drag runtime data into
// the static shell and fail the build (the bar renders outside Suspense
// so it can't vanish during streaming; V2.1 rule).
export function TournamentTabBar({ isAdmin }: Props) {
  const pathname = usePathname();
  // Always /tournaments/<id>[/...] — the bar only renders in the mini-app.
  const base = pathname.split("/").slice(0, 3).join("/");

  const tabs = [
    { href: base, label: "Home", icon: Home, exact: true, disabled: false },
    {
      href: `${base}/schedule`,
      label: "Schedule",
      icon: CalendarDays,
      exact: false,
      disabled: false,
    },
    {
      href: `${base}/admin`,
      label: "Admin",
      icon: Settings,
      exact: false,
      disabled: !isAdmin,
    },
    {
      href: `${base}/ledger`,
      label: "Ledger",
      icon: Wallet,
      exact: false,
      disabled: false,
    },
    // exact — with the prefix rule every mini-app pathname starts with
    // /tournaments, so this tab would always render active.
    {
      href: "/tournaments",
      label: "Tournaments",
      icon: Undo2,
      exact: true,
      disabled: false,
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom))] z-10 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-md">
        {tabs.map(({ href, label, icon: Icon, exact, disabled }) => {
          if (disabled || href === null) {
            return (
              <div
                key={label}
                aria-disabled="true"
                className="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-text-muted opacity-50"
              >
                <Icon size={20} strokeWidth={2} />
                <span className="whitespace-nowrap text-center text-[11px] font-semibold leading-tight">
                  {label}
                </span>
              </div>
            );
          }
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            // Keyed by label, not href: while exiting to /tournaments the
            // pathname flips before this bar unmounts, making base equal
            // the Tournaments tab's href — href keys would collide there.
            <Link
              key={label}
              href={href}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2",
                active ? "text-accent" : "text-text-muted",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 2} />
              <span
                className={cn(
                  // nowrap — "Tournaments" barely fits a fifth of a
                  // 360px screen; wrapping would grow the bar height.
                  "whitespace-nowrap text-center text-[11px] leading-tight",
                  active ? "font-bold" : "font-semibold",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
