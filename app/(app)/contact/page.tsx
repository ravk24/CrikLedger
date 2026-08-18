import { PolicyPage } from "@/components/legal/PolicyPage";

export const metadata = { title: "Contact us · CrikLedger" };

// Static by design — see components/legal/PolicyPage.
export default function Contact() {
  return (
    <PolicyPage title="Contact us" updated="18 August 2026">
      <p>TODO(ravi): fill in before the Razorpay review.</p>
      <h2>Support</h2>
      <p>Email: TODO(ravi)</p>
      <h2>Business address</h2>
      <p>TODO(ravi): registered address.</p>
      <h2>Response time</h2>
      <p>We aim to reply to support email within two working days.</p>
    </PolicyPage>
  );
}
