"use client";

import { useState } from "react";
import { Loader2, Share2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type FileProps = {
  endpoint: string; // GET route that returns the file
  filename: string;
  title: string; // share-sheet title
  label: string; // aria-label and tooltip — says what the tap does
  mimeType: string;
  icon: LucideIcon;
  errorText: string;
  // Companion message: copied to the clipboard on tap (WhatsApp drops
  // share-sheet text riding with files, so paste-below-the-image is
  // the reliable channel) and passed to navigator.share as best
  // effort. Callers build it server-side, admin-gated.
  shareText?: string;
  className?: string;
};

// Icon-only "send this file somewhere" button, admin surfaces only (the
// caller gates it). Native share sheet first, where the device has one
// AND accepts the file type — the WhatsApp path on Android for images.
// Plain download otherwise: desktop, and Android Chrome for .xlsx, which
// it refuses in the share sheet. The caller picks the glyph and label
// to match the path the file will actually take.
export function DownloadFileButton({
  endpoint,
  filename,
  title,
  label,
  mimeType,
  icon: Icon,
  errorText,
  shareText,
  className,
}: FileProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    // Copy FIRST, inside the tap's user activation — iOS revokes the
    // gesture after the fetch await below, and a failed copy must not
    // block the file share.
    if (shareText) {
      try {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch {
        // Clipboard needs a secure context — the text still rides
        // navigator.share below where the target accepts it.
      }
    }
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) {
        // Failures arrive in the JSON envelope; say why when it says.
        let message = errorText;
        try {
          const body = await res.json();
          if (typeof body?.error?.message === "string") message = body.error.message;
        } catch {
          // Not JSON — keep the generic text.
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const file = new File([blob], filename, { type: mimeType });

      if (
        typeof navigator !== "undefined" &&
        navigator.canShare?.({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title,
            ...(shareText ? { text: shareText } : {}),
          });
        } catch (e) {
          // Some UAs accept files but reject a text rider — retry
          // file-only rather than losing the share.
          if (shareText && (e as Error)?.name === "TypeError") {
            await navigator.share({ files: [file], title });
          } else {
            throw e;
          }
        }
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
        setCopied(false);
        setError((e as Error)?.message || errorText);
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
        aria-label={label}
        title={label}
        className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface shadow-card text-text-secondary disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Icon size={18} />
        )}
      </button>
      {error ? (
        <span
          role="alert"
          className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md border border-border bg-surface shadow-card px-2 py-1 text-xs text-debit shadow-sm"
        >
          {error}
        </span>
      ) : copied ? (
        <span
          role="status"
          className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md border border-border bg-surface shadow-card px-2 py-1 text-xs text-credit shadow-sm"
        >
          Message copied — paste it below the image.
        </span>
      ) : null}
    </span>
  );
}

type ImageProps = {
  endpoint: string; // GET route that returns a PNG
  filename: string;
  title: string;
  shareText?: string;
  className?: string;
};

// The PNG flavour every share surface uses — unchanged call signature.
// A share glyph, not a download one: these images exist to be dropped in
// the team WhatsApp group, and the match-sheet and guest buttons already
// say "Share" with Share2.
export function DownloadImageButton(props: ImageProps) {
  return (
    <DownloadFileButton
      {...props}
      label={`Share ${props.title} image`}
      mimeType="image/png"
      icon={Share2}
      errorText="Could not build the image — try again."
    />
  );
}
