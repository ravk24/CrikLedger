import { Suspense } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getNavState } from "@/lib/nav";

// Purchases placeholder. The catalogue and entitlement grants are
// Features 3 and 5; this exists so the More drawer and every "get the
// Team Ledger" call to action have somewhere real to land.
//
// V1 has no payment gateway: the buy action opens a prefilled mail
// composer, the operator replies with payment instructions, and a
// megaadmin grants the entitlement once the payment is verified. The full
// flow is written out on /how-to-buy — keep the two in step.
//
// Prices are duplicated on the public /pricing page and in the Terms.
// Keep the three in step until Feature 3's products table makes one of
// them the source of truth.
const PRODUCTS = [
  {
    key: "team_ledger" as const,
    name: "Ledger",
    price: "₹99",
    blurb:
      "Your team's full app: players, matches, slots, the pool and per-player balances. One purchase runs one team, with up to two admins.",
  },
  {
    key: "tournament_credit" as const,
    name: "Tournament",
    price: "₹29",
    blurb:
      "Host one tournament with its own players, matches and ledger, kept separate from your team's books.",
  },
];

// Prefilled so the operator gets the product name without a round trip.
// The account email is asked for rather than injected: this is a static
// string built at render time and the mail composer runs on the user's
// device, so there is nothing to leak either way, but the address the
// customer actually wants receipts on is not always the one they signed
// up with.
const SUPPORT_EMAIL = "crikledger@gmail.com";

function buyMailto(name: string, price: string) {
  const subject = `CrikLedger purchase — ${name} (${price})`;
  const body = [
    `I would like to buy the ${name} feature (${price}).`,
    "",
    "My CrikLedger account email:",
    "",
    "Please send me the payment instructions.",
  ].join("\n");
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

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
              <span className="ml-2 text-sm font-bold text-text-secondary">
                {p.price}
              </span>
            </h2>
            {owned[p.key] && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-credit-light px-2 py-0.5 text-[11px] font-medium text-credit-foreground">
                <Check size={12} /> Active
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-text-secondary">{p.blurb}</p>
          {owned[p.key] ? (
            <div
              aria-disabled="true"
              className="mt-3 flex h-11 items-center justify-center rounded-md border border-border bg-surface-secondary text-sm font-medium text-text-muted opacity-60"
            >
              Already yours
            </div>
          ) : (
            <a
              href={buyMailto(p.name, p.price)}
              className="mt-3 flex h-11 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground"
            >
              Email us to buy
            </a>
          )}
        </section>
      ))}
      <p className="text-center text-xs text-text-muted">
        One-time purchases, no subscription. See{" "}
        <Link
          href="/how-to-buy"
          className="text-accent underline underline-offset-2"
        >
          how to purchase
        </Link>
        ,{" "}
        <Link href="/pricing" className="text-accent underline underline-offset-2">
          full pricing
        </Link>{" "}
        and{" "}
        <Link
          href="/refund-policy"
          className="text-accent underline underline-offset-2"
        >
          refund terms
        </Link>
        .
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
