import { MessageSquarePlus } from "lucide-react";
import { SUPPORT_EMAIL, WHATSAPP_NUMBER } from "@/lib/contact";

const FEEDBACK_PREFILL = encodeURIComponent(
  "Hi CrikLedger, I have a suggestion: ",
);

// The "Suggest a feature" tile from the More drawer. Fully static —
// plain <a>s to WhatsApp and mail, no client JS, nothing stored. Lived
// as a card under the More grid until 2026-09-16; moved here so the
// drawer stays one even grid of tiles (same shape as /share-app).
export default function Feedback() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">
          Suggest a feature
        </h1>
        <p className="mt-0.5 text-xs text-text-muted">
          It goes straight to the person who builds the app.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface shadow-card p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-light text-accent">
            <MessageSquarePlus size={18} />
          </span>
          <h2 className="text-sm font-semibold text-text-primary">
            Help us make CrikLedger better
          </h2>
        </div>
        <p className="text-sm text-text-secondary">
          Think a feature could work better, or have an idea for how
          something should be built? Send it to us — every message is read
          by the person who builds the app.
        </p>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${FEEDBACK_PREFILL}`}
          className="flex h-11 w-full items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground"
        >
          WhatsApp your idea
        </a>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("CrikLedger feedback")}`}
          className="flex h-11 w-full items-center justify-center rounded-md border border-border bg-surface shadow-card text-sm font-medium text-text-primary"
        >
          Email us
        </a>
      </section>
    </>
  );
}
