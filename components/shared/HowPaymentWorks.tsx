import Link from "next/link";

// The manual-payment explainer card, extracted from /pricing so the
// tournaments directory can show it inside its pricing curtain. Static and
// session-free on purpose — /pricing must stay prerendered (see the header
// comment in app/(app)/pricing/page.tsx).
export function HowPaymentWorks() {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface shadow-card p-4 text-sm text-text-secondary">
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
  );
}
