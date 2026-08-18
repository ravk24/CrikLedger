import { PolicyPage } from "@/components/legal/PolicyPage";

export const metadata = { title: "Disclaimer · CrikLedger" };

// Static by design — see components/legal/PolicyPage.
export default function Disclaimer() {
  return (
    <PolicyPage title="Disclaimer" updated="18 August 2026">
      <p>
        CrikLedger is a software application designed to help amateur cricket
        teams record and calculate team expenses, player contributions, and
        balances.
      </p>

      <h2>Not a financial service</h2>
      <p>CrikLedger is not:</p>
      <ul>
        <li>A bank</li>
        <li>A wallet</li>
        <li>An accounting service</li>
        <li>A payment intermediary</li>
        <li>An escrow service</li>
        <li>An investment service</li>
        <li>A financial advisory service</li>
      </ul>
      <p>
        CrikLedger does not hold, receive, transfer, or settle money between
        players.
      </p>

      <h2>Money between players</h2>
      <p>
        CrikLedger calculates and records amounts based on information entered
        by users. For example, if the application calculates that a player owes
        ₹200, that amount is only a record within the application.
      </p>
      <p>
        The actual ₹200 is settled between the relevant players or team members
        outside CrikLedger. CrikLedger does not collect it, hold it, or transfer
        it to another player.
      </p>

      <h2>Accuracy</h2>
      <p>
        CrikLedger&apos;s calculations depend on the information entered by
        users. Users are responsible for entering accurate match expenses,
        contributions, payments, and other information, and should verify
        important records before relying on them.
      </p>

      <h2>No financial or tax advice</h2>
      <p>
        CrikLedger does not provide accounting, tax, financial, investment, or
        other professional financial advice. Users remain responsible for their
        own financial, tax, accounting, and reporting obligations.
      </p>

      <h2>Software availability</h2>
      <p>
        Although reasonable efforts are made to maintain the service, CrikLedger
        does not guarantee that the application will always be available without
        interruption or errors.
      </p>
    </PolicyPage>
  );
}
