"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { SITE_URL } from "@/lib/site";

const SHARE_TEXT =
  "I use CrikLedger to track our cricket team's match fees, car allowances and the pool — try it:";
const SHARE_MESSAGE = `${SHARE_TEXT} ${SITE_URL}`;

// Native share sheet where the device has one (the WhatsApp path on
// phones); otherwise the message is copied to the clipboard. A plain
// wa.me link sits alongside for people who just want WhatsApp — no
// number, so the sender picks the friend.
export function ShareAppActions() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setError(null);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "CrikLedger",
          text: SHARE_TEXT,
          url: SITE_URL,
        });
        return;
      }
      await navigator.clipboard.writeText(SHARE_MESSAGE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // A cancelled native share rejects too — not worth an error.
      if ((e as Error)?.name !== "AbortError") {
        setError("Could not share — copy the link below instead.");
      }
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <p className="text-sm text-text-secondary">{SHARE_MESSAGE}</p>
      <button
        type="button"
        onClick={() => void share()}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-accent-foreground"
      >
        {copied ? <Check size={16} /> : <Share2 size={16} />}
        {copied ? "Copied" : "Share"}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(SHARE_MESSAGE)}`}
        target="_blank"
        rel="noopener"
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface text-sm font-medium text-text-primary"
      >
        <MessageCircle size={16} />
        Send on WhatsApp
      </a>
      <button
        type="button"
        onClick={() => void share()}
        className="flex items-center justify-center gap-1 text-xs text-text-muted"
      >
        <Copy size={12} /> {SITE_URL}
      </button>
      {error && <p className="text-xs text-debit">{error}</p>}
    </section>
  );
}
