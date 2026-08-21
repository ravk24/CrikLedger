import Link from "next/link";
import { ChevronRight, PlayCircle, Smartphone } from "lucide-react";
import { ProductCard } from "@/components/shared/ProductCard";
import { PRODUCTS } from "@/lib/products";
import type { NavState } from "@/lib/nav";

// Home for anyone without a Team Ledger: four cards — how to get the
// app onto a phone, a way into the free sample match, and the two
// things there are to buy.
//
// The install walkthrough itself moved back to /install and is reached
// through the first card. The second is the only pointer from Home to
// the demo: /schedule renders GuestMatchFlow for anyone without a
// Ledger, and that flow opens on the scheduled sample with its
// "Complete the match" button — so a plain link lands the visitor
// exactly where they need to be, no query param or initial-step prop
// required. Home is a shop window: try it first, then the prices.
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

      <Link
        href="/install"
        className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent">
          <Smartphone size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text-primary">
            How to install
          </span>
          <span className="block text-xs text-text-muted">
            Put CrikLedger on your home screen — no app store needed
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-text-muted" />
      </Link>

      <Link
        href="/schedule"
        className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent">
          <PlayCircle size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text-primary">
            See how it works
          </span>
          <span className="block text-xs text-text-muted">
            Take a CrikLedger feature for a spin
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-text-muted" />
      </Link>

      {PRODUCTS.map((p) => (
        <ProductCard key={p.key} product={p} href="/how-to-buy" />
      ))}
    </>
  );
}
