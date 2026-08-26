import { Car, Users } from "lucide-react";
import { FeeAmount } from "@/components/shared/FeeAmount";
import { Money } from "@/components/shared/Money";
import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CaptainMark } from "@/components/shared/CaptainMark";
import {
  rowKey,
  type PreviewRow,
  type PreviewTotals,
  type WizardPlayer,
} from "@/components/wizard/wizardTypes";

type Props = {
  rows: PreviewRow[]; // engine output, shown as-is — fees are not editable
  players: WizardPlayer[];
  totals: PreviewTotals; // engine output — nothing is recomputed here
  carAllowancePerCar?: number; // informational — drivers keep it
  fundLabel?: string; // "pool" (SG) or "fund" (tournaments)
};

export function StepFeePreview({
  rows,
  players,
  totals,
  carAllowancePerCar = 0,
  fundLabel = "pool",
}: Props) {
  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Unknown";
  const perHead = totals.per_player_fee + totals.car_share_per_sharer;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
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
                {players.find((p) => p.id === row.player_id)?.is_captain && (
                  <CaptainMark />
                )}
                {row.brought_car && (
                  <Car size={14} className="shrink-0 text-accent" />
                )}
                {row.shared_car && !row.brought_car && (
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
                <FeeAmount fee={row.fee} className="text-sm font-semibold" />
              </span>
            </div>
          );
        })}
        </div>
      </div>

      {totals.guest_rows.length > 0 && (
        <div className="rounded-lg border border-low-light bg-surface">
          <div className="divide-y divide-border">
            {totals.guest_rows.map((guest, i) => (
              <div
                key={`${guest.name}-${i}`}
                className="flex min-h-10 items-center justify-between gap-2 px-4 py-2"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-text-primary">
                  <span className="truncate">{guest.name}</span>
                  {guest.brought_car && (
                    <Car size={14} className="shrink-0 text-accent" />
                  )}
                  {guest.shared_car && !guest.brought_car && (
                    <Users
                      size={13}
                      aria-label="Shared a car"
                      className="shrink-0 text-text-muted"
                    />
                  )}
                </span>
                <FeeAmount fee={guest.fee} className="text-sm font-semibold" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-md bg-surface-secondary p-3 text-sm">
        {totals.car_count > 0 && carAllowancePerCar > 0 && (
          <div className="mb-0.5 flex justify-between">
            <span className="text-text-secondary">
              Cars {totals.car_count} × ₹{formatRupees(carAllowancePerCar)}
            </span>
            <Money
              amount={totals.car_count * carAllowancePerCar}
              className="font-semibold"
            />
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-text-secondary">Total match cost</span>
          <Money amount={totals.total_cost} className="font-semibold" />
        </div>
        <div className="mt-0.5 flex justify-between">
          <span className="text-text-secondary">Per head</span>
          <Money amount={perHead} className="font-semibold" />
        </div>
        <div className="mt-0.5 flex justify-between">
          <span className="text-text-secondary">Collected</span>
          <Money amount={totals.collected_total} className="font-semibold" />
        </div>
        <div className="mt-0.5 flex justify-between">
          <span className="font-semibold text-credit">
            Rounding surplus credited to {fundLabel}
          </span>
          <Money
            amount={totals.surplus_to_pool}
            variant="signed"
            className="font-bold"
          />
        </div>
      </div>
    </div>
  );
}
