"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

// Scoped error boundary for the (app) group. Without it, a failed query
// inside a streamed hole (a pool timeout, a PostgREST 500 on a flaky
// connection) unwound to Next's built-in boundary and replaced the whole
// page — header, tab bar and everything already streamed — with the
// default error screen. This keeps the shell and offers a retry.
//
// It renders NO data and NO placeholder numbers: a boundary on a money
// ledger must say "couldn't load", never show a figure that might be
// wrong.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app]", error);
  }, [error]);

  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface shadow-card p-6 text-center">
      <h2 className="text-base font-semibold text-text-primary">
        Couldn&rsquo;t load this page
      </h2>
      <p className="max-w-xs text-sm text-text-secondary">
        The connection to the ledger dropped before the figures arrived.
        Nothing was changed — try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-1 flex h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground"
      >
        <RefreshCw size={16} aria-hidden />
        Try again
      </button>
    </section>
  );
}
