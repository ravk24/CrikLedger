import Link from "next/link";
import { ProductCard } from "@/components/shared/ProductCard";
import { PRODUCTS } from "@/lib/products";

export const metadata = {
  title: "Pricing · CrikLedger",
  description:
    "CrikLedger pricing — Ledger ₹99, refundable within 30 days, and Tournament ₹29, non-refundable. One-time purchases, no subscription.",
};

// PUBLIC and STATIC on purpose.
//
// /purchases is the in-app buy surface and sits behind the proxy matcher,
// so a signed-out visitor — a prospective customer — is redirected to
// /login and never sees a price. This page is the catalogue: no session
// reads, nothing dynamic, so it stays crawlable and prerendered. Do NOT
// add getNavState() here.
//
// The catalogue itself lives in lib/products.ts, which /pricing, Home
// and the refund copy all read, so a price or a refund term is stated
// once. When Feature 3 lands a products table, that file reads from it.
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
        <ProductCard key={p.key} product={p} />
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
            Call +91 9142349007
          </a>{" "}
          ·{" "}
          <a
            href="https://wa.me/919142349007"
            className="font-medium text-accent underline underline-offset-2"
          >
            WhatsApp
          </a>
        </p>
        <p className="text-xs text-text-muted">
          CrikLedger does not store card numbers, CVV, UPI credentials, or bank
          credentials. Never send us your password, UPI PIN, OTP, CVV, or
          banking credentials.
        </p>

        <h2 className="mt-1 text-sm font-semibold text-text-primary">Refunds</h2>
        <p>
          <strong className="font-semibold text-text-primary">Ledger</strong>{" "}
          purchases are eligible for a refund if requested within 30 days of
          purchase, subject to the{" "}
          <Link
            href="/refund-policy"
            className="font-medium text-accent underline underline-offset-2"
          >
            cancellation &amp; refund policy
          </Link>
          .
        </p>
        <p>
          The{" "}
          <strong className="font-semibold text-text-primary">
            Tournament
          </strong>{" "}
          feature is <strong className="font-semibold text-text-primary">not
          refundable</strong>. Please review what it includes before buying.
        </p>
      </section>

      <p className="text-center text-xs text-text-muted">
        Ready to buy?{" "}
        <Link
          href="/how-to-buy"
          className="text-accent underline underline-offset-2"
        >
          How payments work
        </Link>
      </p>
    </>
  );
}
