import Link from "next/link";
import { ChevronRight, PlayCircle, Receipt } from "lucide-react";
import type { NavState } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { InstallCard } from "./InstallCard";
import { renderInstallDiagrams } from "./installDiagrams";

// Home's three choices: get the app, try it, see what it costs. Rows
// rather than a catalogue — /pricing holds the actual product cards, so
// a visitor meets prices, features and refund terms once they ask for
// them rather than on the landing screen.
//
// "How to install" expands in place (InstallCard) so the visitor never
// leaves Home; /install stays as the standalone route Ledger holders
// reach from More and from InstallNudge. /schedule renders
// GuestMatchFlow for anyone without a Ledger, opening on the scheduled
// sample and its "Complete the match" button, so a plain link lands the
// visitor exactly there.
const LINK_CARDS = [
  {
    href: "/schedule",
    icon: PlayCircle,
    chip: "bg-low-light text-low-foreground",
    title: "See how it works",
    subtitle: "Take a CrikLedger feature for a spin",
  },
  {
    href: "/pricing",
    icon: Receipt,
    chip: "bg-credit-light text-credit-foreground",
    title: "Pricing",
    subtitle: "Choose the tools your team needs",
  },
];

// Home for anyone without a Team Ledger.
//
// Ledger holders never see this: app/(app)/page.tsx sends them to their
// team dashboard instead.
export function HomeIntro({ nav }: { nav: NavState }) {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">
          {nav.accountName ? `Welcome, ${nav.accountName}` : "Welcome to CrikLedger"}
        </h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Match fees, car allowances and the team pool — worked out for you
        </p>
      </div>

      <InstallCard diagrams={renderInstallDiagrams()} />

      {LINK_CARDS.map(({ href, icon: Icon, chip, title, subtitle }) => (
        <Link
          key={href}
          href={href}
          className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface shadow-card p-4"
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md",
              chip,
            )}
          >
            <Icon size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-text-primary">
              {title}
            </span>
            <span className="block text-xs text-text-muted">{subtitle}</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-text-muted" />
        </Link>
      ))}
    </>
  );
}
