import { PolicyPage } from "@/components/legal/PolicyPage";

export const metadata = { title: "Disclaimer · CrikLedger" };

// Static by design — see components/legal/PolicyPage.
export default function Disclaimer() {
  return (
    <PolicyPage title="Disclaimer" updated="18 August 2026">
      <p>
        CrikLedger is a record-keeping and calculation tool for amateur
        cricket teams. It is not an accounting, banking, or payment
        service between players.
      </p>
      <h2>Money between players</h2>
      <p>
        The app calculates what each player owes and records what has been
        collected. It does not hold, move, or settle money between players
        — cash changes hands offline, exactly as it did before.
      </p>
      <h2>Accuracy</h2>
      <p>
        Figures are only as good as what is entered. Check a match sheet
        before sharing it.
      </p>
    </PolicyPage>
  );
}
