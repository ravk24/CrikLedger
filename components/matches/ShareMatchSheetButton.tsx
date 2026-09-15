"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import {
  buildMatchSheetMessage,
  type MatchSheetMessage,
} from "@/lib/feeMessage";

export type MatchSheetPayload = {
  team: string;
  opponent: string;
  venue?: string;
  date: string;
  groundFee: number;
  ballFee: number;
  otherFee: number;
  carAllowancePerCar?: number;
  carCount?: number;
  totalCost: number; // cash + cars
  perPlayerFee?: number; // base share
  carSharePerSharer?: number;
  sharerCount?: number;
  surplus: number;
  rows: {
    name: string;
    fee: number;
    broughtCar: boolean;
    isCaptain?: boolean;
    isViceCaptain?: boolean;
    isGuest?: boolean;
  }[];
};

export type { MatchSheetMessage };

// The completed match as a PNG for the WhatsApp group — the same route
// and share/download fallback the guest sample uses; the payload is
// assembled by the server page from the stored rows, so the image shows
// exactly what the ledger recorded. When feeMessage is present the
// companion text (guest transfer list, or the deposit reminder when the
// match had no guests) is copied to the clipboard (WhatsApp drops share-sheet
// text that rides alongside files, so paste-below-the-image is the
// reliable channel) and passed to navigator.share as best effort.
export function ShareMatchSheetButton({
  payload,
  feeMessage,
}: {
  payload: MatchSheetPayload;
  feeMessage?: MatchSheetMessage;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setError(null);
    const message = feeMessage ? buildMatchSheetMessage(feeMessage) : null;
    // Copy FIRST, inside the tap's user activation — iOS revokes the
    // gesture after the fetch await below, and a failed copy must not
    // block the image share.
    if (message) {
      try {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch {
        // Clipboard needs a secure context — the text still rides
        // navigator.share below where the target accepts it.
      }
    }
    try {
      const res = await fetch("/api/share/match-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("render failed");
      const blob = await res.blob();
      const file = new File([blob], "match-sheet.png", { type: "image/png" });
      if (
        typeof navigator !== "undefined" &&
        navigator.canShare?.({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: "Match sheet",
            ...(message ? { text: message } : {}),
          });
        } catch (e) {
          // Some UAs accept files but reject a text rider — retry
          // image-only rather than losing the share.
          if (message && (e as Error)?.name === "TypeError") {
            await navigator.share({ files: [file], title: "Match sheet" });
          } else {
            throw e;
          }
        }
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "match-sheet.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setError("Could not build the image — try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void share()}
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface shadow-card text-sm font-medium text-text-primary disabled:opacity-60"
      >
        <Share2 size={16} />
        {busy ? "Building…" : "Share match sheet"}
      </button>
      {copied && (
        <p className="text-xs text-credit">
          Fee message copied — paste it below the image.
        </p>
      )}
      {error && <p className="text-xs text-debit">{error}</p>}
    </div>
  );
}
