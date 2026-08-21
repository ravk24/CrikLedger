import Link from "next/link";
import { ChevronRight, PlayCircle, Receipt, Smartphone } from "lucide-react";
import type { NavState } from "@/lib/nav";

// Home's three choices: get the app, try it, see what it costs. Rows
// rather than a catalogue — /pricing holds the actual product cards, so
// a visitor meets prices, features and refund terms once they ask for
// them rather than on the landing screen.
//
// /install and /schedule are the other two: /schedule renders
// GuestMatchFlow for anyone without a Ledger, opening on the scheduled
// sample and its "Complete the match" button, so a plain link lands the
// visitor exactly there.
const CARDS = [
  {
    href: "/install",
    icon: Smartphone,
    title: "How to install",
    subtitle: "Put CrikLedger on your home screen — no app store needed",
  },
  {
    href: "/schedule",
    icon: PlayCircle,
    title: "See how it works",
    subtitle: "Take a CrikLedger feature for a spin",
  },
  {
    href: "/pricing",
    icon: Receipt,
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

      {CARDS.map(({ href, icon: Icon, title, subtitle }) => (
        <Link
          key={href}
          href={href}
          className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent">
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
