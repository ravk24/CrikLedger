import { InstallGuide } from "@/components/install/InstallGuide";
import { renderInstallDiagrams } from "@/components/install/installDiagrams";

export const metadata = {
  title: "Install CrikLedger",
  description:
    "How to add CrikLedger to your home screen on Android and iPhone. CrikLedger is a PWA — there is nothing to download from an app store.",
};

// PUBLIC and STATIC on purpose. This page must be readable signed out,
// and it reads nothing about you — so do NOT add getNavState() here:
// a dynamic read in the page body fails the build under cacheComponents.
// Home renders the same guide inside components/install/InstallCard for
// visitors without a Ledger; this route is how a Ledger holder, who lands
// on their dashboard instead, still gets to it from More.
export default function InstallPage() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">
          Install CrikLedger
        </h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Works on Android and iPhone — no app store needed
        </p>
      </div>

      <InstallGuide diagrams={renderInstallDiagrams()} />
    </>
  );
}
