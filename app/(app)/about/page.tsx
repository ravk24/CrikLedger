import { PolicyPage } from "@/components/legal/PolicyPage";

export const metadata = { title: "About CricLedger · CricLedger" };

// Static by design — see components/legal/PolicyPage.
export default function About() {
  return (
    <PolicyPage title="About CricLedger" updated="18 August 2026">
      <p>
        CricLedger is a mobile-first ledger for amateur cricket teams. It
        works out what each player owes after a match — ground fee, balls,
        and car allowances for whoever drove — and keeps a running balance
        for every player and for the team pool.
      </p>
      <h2>Who it is for</h2>
      <p>
        Weekend teams who currently settle up over WhatsApp and a notes app.
        One person schedules the match, completes it afterwards, and the
        split is calculated and recorded in one pass.
      </p>
      <h2>Contact</h2>
      <p>
        TODO(ravi): registered business name, address and support email
        before the Razorpay review.
      </p>
    </PolicyPage>
  );
}
