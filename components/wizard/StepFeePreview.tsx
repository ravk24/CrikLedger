"use client";

import { Car, Users } from "lucide-react";
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
  rows: PreviewRow[]; // engine output, shown as-is — fees are not editable
  players: WizardPlayer[];
  perPlayerFee: number; // the base head share
  carSharePerSharer: number; // added on top for whoever rode with someone
  sharerCount: number;
  totalCost: number;
  cashCosts: number; // ground + balls + other (pool pays these)
  guestRows: GuestPreviewRow[];
  captainCharge: number; // canonical — computed by the engine
  captainName: string | null;
  fundLabel?: string; // "pool" (SG) or "fund" (tournaments)
};

export function StepFeePreview({
  rows,
  players,
  perPlayerFee,
  carSharePerSharer,
  sharerCount,
  totalCost,
  cashCosts,
  guestRows,
  captainCharge,
  captainName,
  fundLabel = "pool",
}: Props) {
  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Unknown";
  const collected = rows.reduce((sum, r) => sum + r.fee, 0) + captainCharge;
  const surplus = collected - cashCosts;
  const headCount = rows.length + guestRows.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-md bg-surface-secondary px-3 py-2">
        <span className="text-sm text-text-secondary">
          {/* With a car share the headline is the BASE split — car money
              is funded separately, by the riders, on the line below. */}
          ₹{formatRupees(carSharePerSharer > 0 ? cashCosts : totalCost)} ÷{" "}
          {headCount} {guestRows.length > 0 ? "heads" : "attendees"}
        </span>
        <span className="text-sm font-semibold text-text-primary">
          ₹{formatRupees(perPlayerFee)} each
        </span>
      </div>
      {carSharePerSharer > 0 && (
        <p className="-mt-1 flex items-center gap-1.5 text-xs text-text-muted">
          <Users size={13} className="shrink-0" />
          Plus ₹{formatRupees(carSharePerSharer)} car share for the{" "}
          {sharerCount} who rode with someone.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="max-h-56 divide-y divide-border overflow-y-auto">
        {rows.map((row) => {
          const key = rowKey(row);
          const isRebate = row.fee < 0;
          return (
            <div
              key={key}
              className="flex min-h-11 items-center justify-between gap-2 px-4 py-2"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-text-primary">
                <span className="truncate">{nameOf(row.player_id)}</span>
                {row.brought_car && (
                  <Car size={14} className="shrink-0 text-accent" />
                )}
                {row.shared_car && (
                  <Users
                    size={13}
                    aria-label="Shared a car"
                    className="shrink-0 text-text-muted"
                  />
                )}
              </span>
              <span
                className={cn(
                  "rounded-md border px-2 py-1",
                  isRebate
                    ? "border-credit-light bg-credit-light/40"
                    : "border-border",
                )}
              >
                <Money
                  amount={row.fee}
                  variant={isRebate ? "signed" : "neutral"}
                  className="text-sm font-semibold"
                />
              </span>
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
                  {guest.shared_car && (
                    <Users
                      size={13}
                      aria-label="Shared a car"
                      className="shrink-0 text-text-muted"
                    />
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
          <span className="text-text-secondary">Collected</span>
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
