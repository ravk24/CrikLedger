import { Suspense } from "react";
import Link from "next/link";
import {
  Car,
  CarFront,
  Info,
  MessageSquarePlus,
  Receipt,
  Share2,
  ShoppingBag,
  Smartphone,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getNavState, type NavState } from "@/lib/nav";
import { cn } from "@/lib/utils";

type Feature = {
  label: string;
  href: string | null; // null = not available to this visitor, renders disabled
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
};

// The app drawer: one 2-column grid of equal tiles, nothing else. A tile
// with href: null renders greyed and inert rather than vanishing — the
// app-wide disabled-not-hidden rule — which also keeps the count at
// eight for every visitor, so the grid is always four even rows.
// Car Counter reads team data, so it needs a Team Ledger; Purchases
// needs a signed-in admin; everything else is public. A tile that needs
// copy or actions links to its own page (/share-app, /feedback) — never
// a differently shaped card under the grid.
function buildFeatures(nav: NavState): Feature[] {
  return [
    // Public and entitlement-free: the app is a PWA and anyone can put it
    // on their home screen. Home shows the same guide, but only to
    // visitors without a Ledger — this tile is how everyone else finds it.
    {
      label: "Install app",
      href: "/install",
      icon: Smartphone,
      iconClass: "bg-accent-light text-accent",
    },
    {
      label: "Car Fee Calculator",
      href: "/car-fee",
      icon: Car,
      iconClass: "bg-low-light text-low-foreground",
    },
    {
      label: "Car Counter",
      href: nav.hasTeamLedger ? "/car-count" : null,
      icon: CarFront,
      iconClass: "bg-scheduled-light text-scheduled-foreground",
    },
    // Pricing is public; Purchases needs a session. A guest must still be
    // able to see what things cost, so Pricing is always live.
    {
      label: "Pricing",
      href: "/pricing",
      icon: Receipt,
      iconClass: "bg-credit-light text-credit-foreground",
    },
    {
      label: "Purchases",
      href: nav.signedIn && !nav.isViewer ? "/purchases" : null,
      icon: ShoppingBag,
      iconClass: "bg-gold-light text-gold-foreground",
    },
    {
      label: "About us",
      href: "/about-us",
      icon: Info,
      iconClass: "bg-inactive-light text-inactive-foreground",
    },
    {
      label: "Share with a friend",
      href: "/share-app",
      icon: Share2,
      iconClass: "bg-accent-light text-accent",
    },
    {
      label: "Suggest a feature",
      href: "/feedback",
      icon: MessageSquarePlus,
      iconClass: "bg-accent-light text-accent",
    },
  ];
}

async function MoreData() {
  const FEATURES = buildFeatures(await getNavState());
  return (
    <section className="grid grid-cols-2 gap-3">
      {FEATURES.map((feature, i) => {
        const Icon = feature.icon;
        const inner = (
          <>
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-md",
                feature.iconClass,
              )}
            >
              <Icon size={18} />
            </span>
            <span className="text-sm font-semibold">{feature.label}</span>
          </>
        );
        return feature.href ? (
          <Link
            key={i}
            href={feature.href}
            className="flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface shadow-card p-4 text-text-primary"
          >
            {inner}
          </Link>
        ) : (
          <div
            key={i}
            aria-disabled="true"
            className="flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface shadow-card p-4 text-text-muted opacity-60"
          >
            {inner}
          </div>
        );
      })}
    </section>
  );
}

export default function More() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">More</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          New features land here.
        </p>
      </div>
      {/* Reads the session to decide which tiles are live, so it must
          sit inside Suspense under cacheComponents. */}
      <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
        <MoreData />
      </Suspense>
    </>
  );
}
