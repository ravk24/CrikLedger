"use client";

import { MoneyInput } from "@/components/shared/MoneyInput";
import { Switch } from "@/components/ui/switch";

type Props = {
  groundLabel: string; // "" when the match has no ground name recorded
  known: boolean; // an amount was prefilled for this ground
  allowance: string; // string per MoneyInput convention
  onAllowanceChange: (value: string) => void;
  ignored: boolean;
  onIgnoredChange: (on: boolean) => void;
  // Guest sample: the amount is fixed, but the ignore switch still works
  // — that is the branch the sample is demonstrating.
  locked?: boolean;
};

// The ignore switch never mutates the allowance value — the wizard
// computes the effective allowance (0 when ignored), so toggling OFF
// restores whatever was typed or prefilled.
export function StepCarAllowance({
  groundLabel,
  known,
  allowance,
  onAllowanceChange,
  ignored,
  onIgnoredChange,
  locked = false,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <MoneyInput
        label="Car allowance (per car)"
        value={allowance}
        onChange={onAllowanceChange}
        disabled={ignored || locked}
      />
      <p className="rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-secondary">
        {known
          ? `Car fee for "${groundLabel}" is above. Type a different amount or just proceed.`
          : groundLabel
            ? `No preset car fee for "${groundLabel}" — enter the per-car amount (or ignore it below).`
            : "Enter the per-car amount for this match (or ignore it below)."}
      </p>
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-surface-secondary px-3 py-2">
        <span className="text-sm font-medium text-text-primary">
          Ignore car fee for this match
        </span>
        <Switch checked={ignored} onCheckedChange={onIgnoredChange} />
      </label>
      {ignored && (
        <p className="text-xs text-text-muted">
          No car rebate this match — drivers are treated the same as everyone
          else (e.g. night matches when everyone drives).
        </p>
      )}
    </div>
  );
}
