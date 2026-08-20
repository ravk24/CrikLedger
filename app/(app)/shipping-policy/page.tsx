import { PolicyPage } from "@/components/legal/PolicyPage";

export const metadata = { title: "Shipping & delivery policy · CrikLedger" };

// Static by design — see components/legal/PolicyPage.
//
// Replaces the old "Return policy" page. A delivery policy is expected of
// any seller, and the requirement is distinct from the physical shipping
// of goods, so a digital-only seller states digital delivery here rather
// than omitting the document. /return-policy redirects here.
export default function ShippingPolicy() {
  return (
    <PolicyPage title="Shipping & delivery policy" updated="20 August 2026">
      <p>
        CrikLedger provides <strong>digital software access only</strong>. No
        physical products are sold through CrikLedger, and therefore no physical
        shipping or delivery is applicable.
      </p>

      <h2>Digital delivery</h2>
      <p>
        After payment has been verified, access to the purchased CrikLedger
        feature is activated electronically within the application. There is no
        physical product, courier delivery, shipping charge, or shipping address
        required.
      </p>

      <h2>Payment confirmation</h2>
      <p>
        CrikLedger currently uses a{" "}
        <a href="/how-to-buy">manual payment process</a>. After making payment,
        customers may be required to provide payment confirmation to CrikLedger.
        Once the payment is verified, CrikLedger activates the purchased feature
        associated with the user&apos;s account.
      </p>

      <h2>Technical issues</h2>
      <p>
        If a payment is successfully completed but the purchased feature is not
        activated, please contact{" "}
        <a href="mailto:crikledger@gmail.com">crikledger@gmail.com</a>. We will
        investigate the issue and take reasonable steps to activate the
        purchased feature or otherwise resolve the matter.
      </p>

      <h2>Contact</h2>
      <p>
        Email <a href="mailto:crikledger@gmail.com">crikledger@gmail.com</a> ·
        Phone <a href="tel:+919142349007">+91 9142349007</a>
      </p>
    </PolicyPage>
  );
}
