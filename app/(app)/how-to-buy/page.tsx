import { PolicyPage } from "@/components/legal/PolicyPage";
import Link from "next/link";

export const metadata = {
  title: "How payments work · CrikLedger",
  description:
    "How payments work on CrikLedger — Ledger ₹99, refundable within 30 days, and Tournament ₹29, non-refundable. Contact us for payment instructions; the feature is activated once payment is verified.",
};

// PUBLIC and STATIC on purpose — see components/legal/PolicyPage.
//
// /purchases is the in-app buy surface and sits behind the proxy matcher,
// so a signed-out visitor never sees it. This page is the buying
// instructions, so it must be readable signed out. Do NOT add
// getNavState() here.
//
// CrikLedger has no payment gateway in V1: the customer pays the operator
// directly and a megaadmin activates the feature by hand. Keep these
// steps in step with /pricing and the Terms.
export default function HowToBuy() {
  return (
    <PolicyPage title="How payments work" updated="20 August 2026">
      <p>
        CrikLedger currently uses a simple manual payment process for its paid
        features.
      </p>

      <h2>Step 1 — Choose your feature</h2>
      <dl>
        <dt>Ledger — ₹99</dt>
        <dd>
          One-time purchase for managing the ledger of one team. Refundable
          within 30 days of purchase, subject to the cancellation &amp; refund
          policy.
        </dd>
        <dt>Tournament — ₹29</dt>
        <dd>
          One-time purchase for managing the financial side of a tournament.
          This feature is not refundable.
        </dd>
      </dl>
      <p>
        See the <Link href="/pricing">pricing page</Link> for what each feature
        includes.
      </p>

      <h2>Step 2 — Contact us</h2>
      <p>
        Get in touch for the current payment instructions. Email{" "}
        <a href="mailto:crikledger@gmail.com">crikledger@gmail.com</a>,{" "}
        <a href="tel:+919142349007">call +91 9142349007</a>, or{" "}
        <a href="https://wa.me/919142349007">message us on WhatsApp</a>. For
        purchase and payment requests we recommend email, so that the
        communication is properly recorded.
      </p>

      <h2>Step 3 — Make the payment</h2>
      <p>
        Pay using the payment method and details we provide. CrikLedger never
        collects payment on this website.
      </p>

      <h2>Step 4 — Send your payment confirmation</h2>
      <p>
        Send us the payment confirmation along with the email address associated
        with your CrikLedger account, so we can match the payment to the right
        account.
      </p>

      <h2>Step 5 — Feature activation</h2>
      <p>
        Once the payment is verified, we activate the purchased feature on your
        account. It appears the next time you open the app.
      </p>

      <h2>Important security note</h2>
      <p>CrikLedger will never need your:</p>
      <ul>
        <li>Password</li>
        <li>UPI PIN</li>
        <li>OTP</li>
        <li>CVV</li>
        <li>Bank account password</li>
        <li>Other payment authentication credentials</li>
      </ul>
      <p>
        Do not share these with anyone claiming to represent CrikLedger.
        CrikLedger does not store card numbers, CVV, UPI credentials, bank
        account credentials, or other payment-instrument credentials.
      </p>

      <h2>Refunds</h2>
      <p>
        <strong>Ledger</strong> purchases are eligible for a refund if
        requested within 30 days of purchase, subject to the{" "}
        <Link href="/refund-policy">cancellation &amp; refund policy</Link>.
      </p>
      <p>
        The <strong>Tournament</strong> feature is{" "}
        <strong>not refundable</strong>, so please check what it includes
        before you buy it.
      </p>

      <h2>Need help?</h2>
      <p>
        Email <a href="mailto:crikledger@gmail.com">crikledger@gmail.com</a> ·
        Call <a href="tel:+919142349007">+91 9142349007</a> ·{" "}
        <a href="https://wa.me/919142349007">WhatsApp</a>
        <br />
        Support hours: Monday–Saturday, 10:00 AM–7:00 PM IST.
      </p>
    </PolicyPage>
  );
}
