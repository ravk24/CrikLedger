"use client";

import { cn } from "@/lib/utils";

type Props = {
  result: "won" | "lost" | null;
  onResult: (result: "won" | "lost") => void;
  abandonReason: string;
  onAbandonReason: (reason: string) => void;
  abandonMode: boolean;
  onAbandonMode: (on: boolean) => void;
};

export function StepResult({
  result,
  onResult,
  abandonReason,
  onAbandonReason,
  abandonMode,
  onAbandonMode,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {(["won", "lost"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              onResult(value);
              onAbandonMode(false);
            }}
            className={cn(
              "flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border text-base font-semibold capitalize",
              result === value && !abandonMode
                ? value === "won"
                  ? "border-credit bg-credit-light text-credit-foreground"
                  : "border-debit bg-debit-light text-debit-foreground"
                : "border-border bg-surface text-text-secondary",
            )}
          >
            {value}
            <span className="text-xs font-normal">
              {result === value && !abandonMode ? "Selected" : "Tap to pick"}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-md bg-surface-secondary p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Match abandoned?</span>
          <button
            type="button"
            onClick={() => onAbandonMode(!abandonMode)}
            className="text-sm font-medium text-accent"
          >
            {abandonMode ? "Back to result" : "Record reason"}
          </button>
        </div>
        {abandonMode && (
          <input
            type="text"
            value={abandonReason}
            onChange={(e) => onAbandonReason(e.target.value)}
            placeholder="Rain, ground unplayable…"
            className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        )}
        {abandonMode && (
          <p className="mt-1 text-xs text-text-muted">
            Abandoning skips every remaining step — zero fees for everyone.
          </p>
        )}
      </div>
    </div>
  );
}
