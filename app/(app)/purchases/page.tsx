import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { WHATSAPP_NUMBER } from "@/lib/contact";
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
      "Your team's full app: players, matches, slots, the pool and per-player balances. One purchase runs one team, with up to two admins. Refundable within 30 days.",
  },
  {
    key: "tournament_credit" as const,
    name: "Tournament",
    price: "₹29",
    blurb:
      "Host one tournament with its own players, matches and ledger, kept separate from your team's books. Not refundable.",
  },
];

// The buy button opens WhatsApp with a prefilled message; the chat
// happens on the user's device, so nothing is sent through our servers.
function buyWhatsApp(name: string, price: string) {
  const text = [
    `Hi CrikLedger, I would like to buy the ${name} feature (${price}).`,
    "",
    "My CrikLedger account email:",
    "",
    "Please send me the payment instructions.",
  ].join("\n");
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

async function PurchasesData() {
  const nav = await getNavState();
  // The shared team-viewer login buys nothing: purchases belong to the
  // superadmin's own account. proxy.ts only proved a signed token.
  if (nav.isViewer) redirect("/");
  const owned = {
    team_ledger: nav.hasTeamLedger,
    tournament_credit: nav.hasTournamentCredit,
  };
  // The Ledger is a one-off; a tournament credit is consumed per
  // tournament, so it can always be bought again — even while active.
  const repurchasable = { team_ledger: false, tournament_credit: true };
  const creditsLeft = nav.tournamentCreditsLeft;

  return (
    <>
      {PRODUCTS.map((p) => (
        <section
          key={p.key}
          className="rounded-lg border border-border bg-surface shadow-card p-4"
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
                <Check size={12} />
                {p.key === "tournament_credit"
                  ? `${creditsLeft} ${creditsLeft === 1 ? "credit" : "credits"} left`
                  : "Active"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-text-secondary">{p.blurb}</p>
          {owned[p.key] && !repurchasable[p.key] ? (
            <div
              aria-disabled="true"
              className="mt-3 flex h-11 items-center justify-center rounded-md border border-border bg-surface-secondary text-sm font-medium text-text-muted opacity-60"
            >
              Already yours
            </div>
          ) : (
            <a
              href={buyWhatsApp(p.name, p.price)}
              target="_blank"
              rel="noopener"
              className="mt-3 flex h-11 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground"
            >
              {p.key === "tournament_credit" && owned[p.key]
                ? "WhatsApp us to buy another credit"
                : "WhatsApp us to buy"}
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
          how payments work
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
        </Link>{" "}
        — the Ledger is refundable within 30 days, the Tournament feature is
        not.
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
