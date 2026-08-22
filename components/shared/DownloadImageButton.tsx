"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  endpoint: string; // GET route that returns a PNG
  filename: string;
  title: string; // share-sheet title and aria-label
  className?: string;
};

// Icon-only "save as image" button, admin surfaces only (the caller
// gates it). Native share sheet where the device has one — the
// WhatsApp path on Android — otherwise a plain download.
export function DownloadImageButton({
  endpoint,
  filename,
  title,
  className,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) throw new Error("render failed");
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });

      if (
        typeof navigator !== "undefined" &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({ files: [file], title });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // A cancelled native share rejects too — not worth an error.
      if ((e as Error)?.name !== "AbortError") {
        setError("Could not build the image — try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        aria-label={`Download ${title} as image`}
        title={`Download ${title} as image`}
        className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface shadow-card text-text-secondary disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Download size={18} />
        )}
      </button>
      {error && (
        <span
          role="alert"
          className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md border border-border bg-surface shadow-card px-2 py-1 text-xs text-debit shadow-sm"
        >
          {error}
        </span>
      )}
    </span>
  );
}
