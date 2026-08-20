import Link from "next/link";
import { Check } from "lucide-react";

export const metadata = {
  title: "Pricing · CrikLedger",
  description:
    "CrikLedger pricing — Ledger ₹99 and Tournament ₹29, one-time purchases with a 30-day refund window.",
};

// PUBLIC and STATIC on purpose.
//
// /purchases is the in-app buy surface and sits behind the proxy matcher,
// so a signed-out visitor — a prospective customer — is redirected to
// /login and never sees a price. This page is the catalogue: no session
// reads, nothing dynamic, so it stays crawlable and prerendered. Do NOT
// add getNavState() here.
//
// Prices must stay in step with /purchases and the Terms page. When
// Feature 3 lands a products table, this page reads from it.
const PRODUCTS = [
  {
    name: "Ledger",
    price: "₹99",
    tagline: "One-time purchase · one team",
    features: [
      "Maintain your team ledger",
      "Add players",
      "Record matches and expenses",
      "Record player contributions",
      "Track payments",
      "Calculate player balances",
      "Identify amounts owed or surplus balances",
      "Maintain the team's running financial record",
    ],
    note: "One purchase provides access for one team. The same account may be reused, but another team requires another Ledger purchase.",
  },
  {
    name: "Tournament",
    price: "₹29",
    tagline: "One-time purchase · one tournament",
    features: [
      "Create a tournament",
      "Add teams",
      "Schedule matches",
      "Record match results",
      "Track player contributions",
      "Track amounts owed or surplus amounts",
    ],
    note: "The Tournament feature is designed for financial management and does not provide tournament standings or rankings.",
  },
];

export default function Pricing() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">Pricing</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Simple one-time purchases. No monthly or annual subscription charges.
        </p>
      </div>

      {PRODUCTS.map((p) => (
        <section
          key={p.name}
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-text-primary">
              {p.name}
            </h2>
            <span className="text-2xl font-bold text-text-primary">
              {p.price}
            </span>
          </div>
          <p className="-mt-2 text-xs text-text-muted">{p.tagline}</p>

          <ul className="flex flex-col gap-1.5">
            {p.features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 text-sm text-text-secondary"
              >
                <Check
                  size={15}
                  className="mt-0.5 shrink-0 text-credit"
                  aria-hidden
                />
                {f}
              </li>
            ))}
          </ul>

          <p className="text-xs text-text-muted">{p.note}</p>
        </section>
      ))}

      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
        <h2 className="text-sm font-semibold text-text-primary">
          How payment works
        </h2>
        <p>
          CrikLedger uses a simple manual payment process — there is no online
          payment gateway.
        </p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 marker:text-text-muted">
          <li>Choose the feature you want to purchase.</li>
          <li>Contact us on the email or phone below for payment instructions.</li>
          <li>Make the payment using the method we provide.</li>
          <li>
            Send your payment confirmation and your CrikLedger account email.
          </li>
          <li>
            Once the payment is verified, we activate the feature on your
            account.
          </li>
        </ol>
        <p>
          <a
            href="mailto:crikledger@gmail.com"
            className="font-medium text-accent underline underline-offset-2"
          >
            crikledger@gmail.com
          </a>{" "}
          ·{" "}
          <a
            href="tel:+919142349007"
            className="font-medium text-accent underline underline-offset-2"
          >
            +91 9142349007
          </a>
        </p>
        <p className="text-xs text-text-muted">
          CrikLedger does not store card numbers, CVV, UPI credentials, or bank
          credentials. Never send us your password, UPI PIN, OTP, CVV, or
          banking credentials.
        </p>

        <h2 className="mt-1 text-sm font-semibold text-text-primary">Refunds</h2>
        <p>
          Purchases are eligible for a refund if requested within 30 days of
          purchase, subject to the{" "}
          <Link
            href="/refund-policy"
            className="font-medium text-accent underline underline-offset-2"
          >
            cancellation &amp; refund policy
          </Link>
          .
        </p>
      </section>

      <p className="text-center text-xs text-text-muted">
        Ready to buy?{" "}
        <Link
          href="/how-to-buy"
          className="text-accent underline underline-offset-2"
        >
          How to purchase
        </Link>
      </p>
    </>
  );
}
