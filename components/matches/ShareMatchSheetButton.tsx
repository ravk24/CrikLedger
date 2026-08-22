"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

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
  totalCost: number;
  surplus: number;
  rows: { name: string; fee: number; broughtCar: boolean; isCaptain?: boolean }[];
  captainNote?: string;
};

// The completed match as a PNG for the WhatsApp group — the same route
// and share/download fallback the guest sample uses; the payload is
// assembled by the server page from the stored rows, so the image shows
// exactly what the ledger recorded.
export function ShareMatchSheetButton({ payload }: { payload: MatchSheetPayload }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setError(null);
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
        await navigator.share({ files: [file], title: "Match sheet" });
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
      {error && <p className="text-xs text-debit">{error}</p>}
    </div>
  );
}
