import { PolicyPage } from "@/components/legal/PolicyPage";

export const metadata = { title: "Shipping & delivery policy · CrikLedger" };

// Static by design — see components/legal/PolicyPage.
//
// Replaces the old "Return policy" page. Razorpay asks every merchant for
// a Shipping Policy and distinguishes that requirement from the physical
// shipping of goods, so a digital-only seller states digital delivery
// here rather than omitting the document. /return-policy redirects here.
export default function ShippingPolicy() {
  return (
    <PolicyPage title="Shipping & delivery policy" updated="18 August 2026">
      <p>
        CrikLedger provides <strong>digital software access only</strong>. No
        physical products are sold through CrikLedger, and therefore no physical
        shipping or delivery is applicable.
      </p>

      <h2>Digital delivery</h2>
      <p>
        After a successful payment, access to the purchased CrikLedger feature
        is activated electronically within the application. There is no physical
        product, courier delivery, shipping charge, or shipping address
        required.
      </p>

      <h2>Payment confirmation</h2>
      <p>
        Payments are processed through Razorpay. Once successful payment is
        confirmed, CrikLedger activates the purchased feature associated with
        the user&apos;s account.
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
