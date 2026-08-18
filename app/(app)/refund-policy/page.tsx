import { PolicyPage } from "@/components/legal/PolicyPage";

export const metadata = { title: "Cancellation & refund policy · CrikLedger" };

// Static by design — see components/legal/PolicyPage.
// Route stays /refund-policy; the title is the fuller name Razorpay asks
// for ("Cancellation/Refunds").
export default function RefundPolicy() {
  return (
    <PolicyPage title="Cancellation & refund policy" updated="18 August 2026">
      <p>
        CrikLedger provides digital software features through one-time
        purchases. There are no recurring subscriptions or automatic
        subscription renewals.
      </p>

      <h2>Refund eligibility</h2>
      <p>
        A customer may request a refund within{" "}
        <strong>30 days from the date of purchase</strong> of a CrikLedger
        feature if they are not satisfied with the service.
      </p>
      <p>
        After 30 days from the purchase date, the purchase is generally
        non-refundable, except where a refund is required by applicable law.
      </p>

      <h2>What can be refunded</h2>
      <p>
        The policy applies to purchases of CrikLedger&apos;s paid digital
        features:
      </p>
      <ul>
        <li>Ledger — ₹99</li>
        <li>Tournament — ₹29</li>
      </ul>

      <h2>How to request a refund</h2>
      <p>
        Email <a href="mailto:crikledger@gmail.com">crikledger@gmail.com</a>, or
        call <a href="tel:+919142349007">+91 9142349007</a>. We recommend using
        email so that the request and subsequent communication are properly
        recorded.
      </p>
      <p>Please include:</p>
      <ul>
        <li>Name associated with the CrikLedger account</li>
        <li>Account email address</li>
        <li>Feature purchased</li>
        <li>Approximate purchase date</li>
        <li>Reason for the refund request</li>
        <li>Payment or transaction reference, if available</li>
      </ul>

      <h2>Refund processing</h2>
      <p>
        Once a refund request is received, we review it and confirm whether it
        falls within the 30-day refund period. If approved, the refund is
        initiated through the payment system used for the original transaction.
      </p>
      <p>
        Razorpay processes refunds on behalf of merchants through its payment
        infrastructure. The time for the refunded amount to appear in your
        account depends on the payment method and your bank.
      </p>

      <h2>Duplicate payments</h2>
      <p>
        If you are charged more than once for the same purchase and the
        duplicate payment is confirmed in our records, the duplicate amount will
        be refunded.
      </p>

      <h2>Payment successful but feature not activated</h2>
      <p>
        If a payment completes but the purchased feature is not activated
        because of a technical issue, please contact us. We will investigate and
        take reasonable steps to provide the purchased feature. If the issue
        cannot reasonably be resolved, an appropriate refund may be provided.
      </p>

      <h2>Cancellation</h2>
      <p>
        Because CrikLedger purchases are one-time purchases, there is no
        recurring subscription to cancel. A customer who wishes to cancel a
        purchase may contact us within <strong>30 days of purchase</strong> and
        request a refund.
      </p>

      <h2>Contact</h2>
      <p>
        Email <a href="mailto:crikledger@gmail.com">crikledger@gmail.com</a> ·
        Phone <a href="tel:+919142349007">+91 9142349007</a>
        <br />
        Support hours: Monday–Saturday, 10:00 AM–7:00 PM IST.
      </p>
    </PolicyPage>
  );
}
