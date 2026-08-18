import { PolicyPage } from "@/components/legal/PolicyPage";

export const metadata = { title: "Refund policy · CrikLedger" };

// Static by design — see components/legal/PolicyPage.
export default function Refunds() {
  return (
    <PolicyPage title="Refund policy" updated="18 August 2026">
      <p>TODO(ravi): confirm the commercial terms before launch.</p>
      <h2>Refund window</h2>
      <p>
        TODO(ravi): state the number of days within which a purchase can be
        refunded, and any conditions.
      </p>
      <h2>How to request a refund</h2>
      <p>
        Email us from the address on your account. Approved refunds are
        returned to the original payment method via Razorpay and typically
        appear within 5–7 working days.
      </p>
    </PolicyPage>
  );
}
