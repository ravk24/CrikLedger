import { PolicyPage } from "@/components/legal/PolicyPage";

export const metadata = { title: "Return policy · CricLedger" };

// Static by design — see components/legal/PolicyPage.
export default function Returns() {
  return (
    <PolicyPage title="Return policy" updated="18 August 2026">
      <p>
        CricLedger sells digital access to software. There is nothing
        physical to ship or return, so no return policy applies in the
        conventional sense.
      </p>
      <h2>Cancelling access</h2>
      <p>
        TODO(ravi): state how a purchase is cancelled and what happens to
        the team&apos;s data afterwards. See also our refund policy.
      </p>
    </PolicyPage>
  );
}
