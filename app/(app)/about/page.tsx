import { PolicyPage } from "@/components/legal/PolicyPage";

export const metadata = { title: "About · CrikLedger" };

// Static by design — see components/legal/PolicyPage.
export default function About() {
  return (
    <PolicyPage title="About CrikLedger" updated="20 August 2026">
      <p>
        CrikLedger is a mobile-first software application designed for amateur
        cricket teams to manage team expenses, player contributions, and
        match-related financial records.
      </p>
      <p>
        CrikLedger helps teams replace spreadsheets, WhatsApp messages, and
        manual calculations with a simple digital ledger. The application
        calculates what each player owes, records what has been paid, and
        maintains the resulting balance for each player and the team.
      </p>
      <p>
        CrikLedger does not handle or transfer the actual money between players.
        It is a record-keeping and calculation tool. Any settlement of amounts
        between players or team members takes place independently of CrikLedger.
      </p>

      <h2>Your data</h2>
      <p>
        Your data is protected and backed up in the CrikLedger application —
        we perform a database backup every 5th day.
      </p>

      <h2>Who it is for</h2>
      <p>
        CrikLedger is designed primarily for amateur cricket teams and players
        who regularly organise matches, tournaments, and shared team expenses.
      </p>
      <p>
        It is particularly useful for teams where one person currently has to
        coordinate expenses, calculate individual contributions, and keep track
        of who has paid and who still owes money.
      </p>

      <h2>What CrikLedger provides</h2>
      <p>The application currently provides two paid features.</p>

      <h3>Ledger — ₹99</h3>
      <p>The Ledger feature helps a team:</p>
      <ul>
        <li>Maintain a financial ledger for one team</li>
        <li>Add and manage players</li>
        <li>Record matches and expenses</li>
        <li>Calculate individual player contributions</li>
        <li>Record amounts paid by players</li>
        <li>Track player balances, including amounts owed or surplus</li>
        <li>Maintain the team&apos;s running financial record</li>
      </ul>
      <p>
        A Ledger purchase provides access for one team. The same account may be
        reused, but a separate purchase is required for another team.
      </p>
      <p>
        The Ledger is <strong>refundable within 30 days</strong> of purchase,
        subject to the{" "}
        <a href="/refund-policy">cancellation &amp; refund policy</a>.
      </p>

      <h3>Tournament — ₹29</h3>
      <p>
        The Tournament feature helps teams manage the financial aspects of a
        tournament by allowing them to:
      </p>
      <ul>
        <li>Create a tournament</li>
        <li>Add participating teams</li>
        <li>Schedule matches</li>
        <li>Record match results</li>
        <li>Track player contributions</li>
        <li>Track amounts owed or surplus amounts</li>
      </ul>
      <p>
        The Tournament feature is focused on financial tracking and does not
        provide tournament standings or a competition-ranking system.
      </p>
      <p>
        The Tournament feature is <strong>not refundable</strong>. Please
        review what it includes before purchasing it.
      </p>

      <h2>Our story</h2>
      <p>
        CrikLedger was started in August 2026 after experiencing the same
        problem within our own cricket team.
      </p>
      <p>
        Team expenses were being managed through WhatsApp messages,
        spreadsheets, and manual calculations. Keeping track of match expenses,
        player contributions, and outstanding balances became unnecessarily
        difficult.
      </p>
      <p>
        CrikLedger was created to make this process simpler, more structured,
        and easier to manage.
      </p>
      <p>
        CrikLedger is currently operated independently by <strong>Ravi Kant</strong>{" "}
        and is in its early beta stage.
      </p>

      <h2>Contact</h2>
      <p>
        Email <a href="mailto:crikledger@gmail.com">crikledger@gmail.com</a> — see
        our <a href="/contact">Contact us</a> page for full details.
      </p>
    </PolicyPage>
  );
}
