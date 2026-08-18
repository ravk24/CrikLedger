"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Home,
  LayoutGrid,
  Swords,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: typeof Home;
  also?: string[]; // child routes that keep this tab highlighted
};

// Five flex-1 tabs share ~380px — labels must stay short enough not to
// wrap. Schedule is a chooser screen (Barne Slots / Other Slots).
const TABS: Tab[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/matches", label: "Matches", icon: Swords },
  {
    href: "/schedule",
    label: "Schedule",
    icon: CalendarDays,
    also: ["/slots", "/other-slots"],
  },
  { href: "/pool", label: "Ledger", icon: Wallet },
  {
    href: "/more",
    label: "More",
    icon: LayoutGrid,
    also: ["/car-fee", "/car-count", "/virtual-fee", "/tournaments"],
  },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom))] z-10 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-md">
        {TABS.map(({ href, label, icon: Icon, also }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : [href, ...(also ?? [])].some((p) => pathname.startsWith(p));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2",
                active ? "text-accent" : "text-text-muted",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 2} />
              <span
                className={cn(
                  "whitespace-nowrap text-[11px]",
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
