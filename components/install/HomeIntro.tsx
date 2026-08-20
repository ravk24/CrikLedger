import type { NavState } from "@/lib/nav";
import { InstallGuide } from "./InstallGuide";
import { NextSteps } from "./NextSteps";

// Slot 0 of the tab bar for anyone without a Team Ledger. It replaced
// the old TeamsDirectory, which listed every team on the platform — a
// list a visitor could look at but never open. The useful thing to hand
// someone on their first visit is how to get the app onto their phone.
//
// Ledger holders never see this: app/(app)/page.tsx sends them to their
// team dashboard instead, and they reach the same guide via /install.
export function HomeIntro({ nav }: { nav: NavState }) {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">
          {nav.accountName ? `Welcome, ${nav.accountName}` : "Welcome to CrikLedger"}
        </h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Match fees, car allowances and the team pool — worked out for you
        </p>
      </div>

      {/* Not installed: the walkthrough. Already installed: the
          confirmation plus somewhere to go next. */}
      <InstallGuide installedSlot={<NextSteps nav={nav} />} />
    </>
  );
}
