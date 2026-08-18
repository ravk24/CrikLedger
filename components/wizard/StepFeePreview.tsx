"use client";

import { useState } from "react";
import { Car } from "lucide-react";
import { Money } from "@/components/shared/Money";
import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  rowKey,
  type GuestPreviewRow,
  type PreviewRow,
  type WizardPlayer,
} from "@/components/wizard/wizardTypes";

type Props = {
  rows: PreviewRow[]; // engine rows with edits already applied
  players: WizardPlayer[];
  editedKeys: Set<string>;
  onEditFee: (key: string, fee: number) => void;
  onResetEdits: () => void;
  perPlayerFee: number;
  totalCost: number;
  cashCosts: number; // ground + balls + other (pool pays these)
  guestRows: GuestPreviewRow[];
  captainCharge: number; // canonical — unaffected by fee edits
  captainName: string | null;
  fundLabel?: string; // "pool" (SG) or "fund" (tournaments)
};

export function StepFeePreview({
  rows,
  players,
  editedKeys,
  onEditFee,
  onResetEdits,
  perPlayerFee,
  totalCost,
  cashCosts,
  guestRows,
  captainCharge,
  captainName,
  fundLabel = "pool",
}: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editError, setEditError] = useState(false);

  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Unknown";
  const collected = rows.reduce((sum, r) => sum + r.fee, 0) + captainCharge;
  const surplus = collected - cashCosts;
  const headCount = rows.length + guestRows.length;

  function commitEdit(key: string) {
    const value = Number(draft);
    if (draft !== "" && Number.isInteger(value)) {
      onEditFee(key, value);
      setEditError(false);
      setEditingKey(null);
      return;
    }
    if (draft === "") {
      // Blank = cancel the edit quietly.
      setEditError(false);
      setEditingKey(null);
      return;
    }
    // Invalid (e.g. "1-2"): keep the editor open and say so instead of
    // silently reverting to the engine value.
    setEditError(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-md bg-surface-secondary px-3 py-2">
        <span className="text-sm text-text-secondary">
          ₹{formatRupees(totalCost)} ÷ {headCount}{" "}
          {guestRows.length > 0 ? "heads" : "attendees"}
        </span>
        <span className="text-sm font-semibold text-text-primary">
          ₹{formatRupees(perPlayerFee)} each
        </span>
      </div>
      {editError && (
        <p className="text-xs text-debit">
          Enter a whole-rupee amount (a minus sign only at the start).
        </p>
      )}
      {editedKeys.size > 0 && (
        <button
          type="button"
          onClick={onResetEdits}
          className="self-end text-xs font-medium text-accent"
        >
          Reset edits
        </button>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="max-h-56 divide-y divide-border overflow-y-auto">
        {rows.map((row) => {
          const key = rowKey(row);
          const edited = editedKeys.has(key);
          const isRebate = row.fee < 0;
          return (
            <div
              key={key}
              className={cn(
                "flex min-h-11 items-center justify-between gap-2 px-4 py-2",
                edited && "bg-accent-light/20",
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-text-primary">
                <span className="truncate">{nameOf(row.player_id)}</span>
                {row.brought_car && (
                  <Car size={14} className="shrink-0 text-accent" />
                )}
                {edited && (
                  <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                )}
              </span>
              {editingKey === key ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft}
                  autoFocus
                  onChange={(e) =>
                    setDraft(e.target.value.replace(/[^0-9-]/g, ""))
                  }
                  onBlur={() => commitEdit(key)}
                  onKeyDown={(e) => e.key === "Enter" && commitEdit(key)}
                  className="h-9 w-20 rounded-md border-[1.5px] border-accent bg-surface px-2 text-right text-base tabular-nums text-text-primary focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingKey(key);
                    setDraft(String(row.fee));
                    setEditError(false);
                  }}
                  className={cn(
                    "rounded-md border px-2 py-1",
                    edited ? "border-accent" : "border-border",
                    isRebate && "border-credit-light bg-credit-light/40",
                  )}
                >
                  <Money
                    amount={row.fee}
                    variant={isRebate ? "signed" : "neutral"}
                    className="text-sm font-semibold"
                  />
                </button>
              )}
            </div>
          );
        })}
        </div>
      </div>

      {guestRows.length > 0 && (
        <div className="rounded-lg border border-low-light bg-surface">
          <div className="divide-y divide-border">
            {guestRows.map((guest, i) => (
              <div
                key={`${guest.name}-${i}`}
                className="flex min-h-10 items-center justify-between gap-2 px-4 py-2"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-text-primary">
                  <span className="truncate">{guest.name}</span>
                  <span className="shrink-0 rounded-[4px] bg-low-light px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-low-foreground">
                    GUEST
                  </span>
                  {guest.brought_car && (
                    <Car size={14} className="shrink-0 text-accent" />
                  )}
                </span>
                <Money
                  amount={guest.fee}
                  variant={guest.fee < 0 ? "signed" : "neutral"}
                  className="text-sm font-semibold"
                />
              </div>
            ))}
          </div>
          {captainName && (
            <p className="border-t border-border px-4 py-2 text-xs text-text-secondary">
              ₹{formatRupees(Math.abs(captainCharge))} will be{" "}
              {captainCharge >= 0 ? "deducted from" : "credited to"}{" "}
              <span className="font-semibold text-text-primary">
                {captainName}
              </span>{" "}
              — guests hand their fee to the captain in cash.
            </p>
          )}
        </div>
      )}

      <div className="rounded-md bg-surface-secondary p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">Total match cost</span>
          <Money amount={totalCost} className="font-semibold" />
        </div>
        <div className="mt-0.5 flex justify-between">
          <span className="text-text-secondary">Collected after edits</span>
          <Money amount={collected} className="font-semibold" />
        </div>
        <div className="mt-0.5 flex justify-between">
          {surplus >= 0 ? (
            <>
              <span className="font-semibold text-credit">
                Rounding surplus credited to {fundLabel}
              </span>
              <Money amount={surplus} variant="signed" className="font-bold" />
            </>
          ) : (
            <>
              <span className="font-semibold text-low">
                Below cost — no {fundLabel} credit
              </span>
              <Money
                amount={surplus}
                variant="balance"
                className="font-bold text-low"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
