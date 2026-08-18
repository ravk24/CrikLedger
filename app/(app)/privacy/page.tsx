import { PolicyPage } from "@/components/legal/PolicyPage";

export const metadata = { title: "Privacy policy · CricLedger" };

// Static by design — see components/legal/PolicyPage.
export default function Privacy() {
  return (
    <PolicyPage title="Privacy policy" updated="18 August 2026">
      <p>
        TODO(ravi): review before launch. This describes what CricLedger
        currently does.
      </p>
      <h2>What we store</h2>
      <p>
        Your account (user id, email, and a hashed password — never the
        password itself), your team&apos;s players, matches, and ledger
        entries. Guest visitors are not tracked into any team: the sample
        match and sample ledger are fixed example data and are never saved.
      </p>
      <h2>Why we store it</h2>
      <p>
        To run the product: to show your team its balances, and to send
        payment receipts to the email on your account.
      </p>
      <h2>Sharing</h2>
      <p>
        We do not sell personal data. Payments are handled by Razorpay,
        which receives the details it needs to process a payment. We use
        PostHog for anonymous product analytics.
      </p>
      <h2>Your data</h2>
      <p>
        Write to us to request a copy of your data or its deletion.
      </p>
    </PolicyPage>
  );
}
