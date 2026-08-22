import { ShareAppActions } from "@/components/more/ShareAppActions";

// The Share card from the More drawer: a friend invite. Fully static —
// the share text and link are constants, nothing is stored or tracked.
export default function ShareApp() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">
          Share CrikLedger
        </h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Know a team still doing match fees on paper? Send them the app.
        </p>
      </div>
      <ShareAppActions />
    </>
  );
}
