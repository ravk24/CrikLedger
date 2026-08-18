import { Suspense } from "react";
import { Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getNavState } from "@/lib/nav";

// Purchases placeholder. Prices, the catalogue and the Razorpay flow are
// Features 3 and 5; this exists so the More drawer and every "get the
// Team Ledger" call to action have somewhere real to land.
//
// The buy buttons are deliberately inert (disabled-not-hidden), not
// hidden — the shape of the offer is part of what sells it.
const PRODUCTS = [
  {
    key: "team_ledger" as const,
    name: "Team Ledger",
    blurb:
      "Your team's full app: players, matches, slots, the pool and per-player balances. One purchase runs one team, with up to two admins.",
  },
  {
    key: "tournament_credit" as const,
    name: "Tournament Credit",
    blurb:
      "Host one tournament with its own players, matches and ledger, kept separate from your team's books.",
  },
];

async function PurchasesData() {
  const nav = await getNavState();
  const owned = {
    team_ledger: nav.hasTeamLedger,
    tournament_credit: nav.hasTournamentCredit,
  };

  return (
    <>
      {PRODUCTS.map((p) => (
        <section
          key={p.key}
          className="rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-text-primary">
              {p.name}
            </h2>
            {owned[p.key] && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-credit-light px-2 py-0.5 text-[11px] font-medium text-credit-foreground">
                <Check size={12} /> Active
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-text-secondary">{p.blurb}</p>
          <div
            aria-disabled="true"
            className="mt-3 flex h-11 items-center justify-center rounded-md border border-border bg-surface-secondary text-sm font-medium text-text-muted opacity-60"
          >
            {owned[p.key] ? "Already yours" : "Pricing coming soon"}
          </div>
        </section>
      ))}
      <p className="text-center text-xs text-text-muted">
        Payments open shortly. Nothing is charged today.
      </p>
    </>
  );
}

export default function Purchases() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">Purchases</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          What CrikLedger offers, and what you already have.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
        <PurchasesData />
      </Suspense>
    </>
  );
}
