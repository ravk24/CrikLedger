"use client";

import { Car, Check } from "lucide-react";
import { CaptainMark } from "@/components/shared/CaptainMark";
import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WizardGuest, WizardPlayer } from "@/components/wizard/wizardTypes";

type Props = {
  players: WizardPlayer[]; // selected players only
  cars: Set<string>; // who drove — drivers cannot be sharers
  shared: Set<string>; // who rode with someone
  onToggleShared: (playerId: string) => void;
  // Bulk, not a loop over onToggleShared: MatchWizard's per-id handler
  // builds its next Set from a render-time closure, so calling it N times
  // in one tick would keep only the last change.
  onSetAllShared: (on: boolean) => void;
  guests: WizardGuest[];
  onToggleGuestShared: (index: number) => void;
  allowance: number;
  carCount: number;
};

// Who rode with someone. This is the step that decides who FUNDS the car
// allowance: the total is split across these people only, so anyone who
// made their own way stops paying for other people's cars.
//
// Drivers are listed but not tickable — they provided the car and take
// the rebate. Guests are tickable: they are heads in the split and their
// charge lands on the captain either way.
export function StepSharedCar({
  players,
  cars,
  shared,
  onToggleShared,
  onSetAllShared,
  guests,
  onToggleGuestShared,
  allowance,
  carCount,
}: Props) {
  const riders = players.filter((p) => !cars.has(p.id));
  const guestRiders = guests.filter((g) => !g.brought_car);
  const sharerCount =
    riders.filter((p) => shared.has(p.id)).length +
    guestRiders.filter((g) => g.shared_car).length;
  // "all" means everyone the list can tick — guests included, since they
  // are heads in the split and sit in the same list.
  const tickable = riders.length + guestRiders.length;
  const allOn =
    tickable > 0 &&
    riders.every((p) => shared.has(p.id)) &&
    guestRiders.every((g) => g.shared_car);
  const carPool = carCount * allowance;
  const each = sharerCount > 0 ? Math.ceil(carPool / sharerCount) : 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">
        {sharerCount > 0
          ? `₹${formatRupees(carPool)} of car allowance split ${sharerCount} ways — ₹${formatRupees(each)} each, on top of their share.`
          : "Nobody has ridden along yet. With no one sharing, no car money is collected and drivers get no rebate."}
      </p>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onSetAllShared(!allOn)}
          className="flex min-h-11 items-center gap-2 text-sm font-medium text-text-primary"
        >
          <span
            className={cn(
              "flex size-[22px] shrink-0 items-center justify-center rounded-sm border-[1.5px]",
              allOn
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border-strong bg-surface",
            )}
          >
            {allOn && <Check size={14} strokeWidth={3} />}
          </span>
          Include all
        </button>
        <span className="ml-3 shrink-0 rounded-full bg-text-primary px-3 py-1 text-xs font-bold text-surface">
          {sharerCount} sharing
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        <div className="max-h-60 divide-y divide-border overflow-y-auto">
          {players.map((player) => {
            const drove = cars.has(player.id);
            const on = shared.has(player.id);

            if (drove) {
              return (
                <div
                  key={player.id}
                  className="flex min-h-11 items-center gap-3 px-4 py-2.5 opacity-50"
                >
                  <span className="flex size-[22px] shrink-0 items-center justify-center">
                    <Car size={16} className="text-accent" />
                  </span>
                  <span className="flex flex-1 items-center gap-1.5 text-sm font-medium text-text-primary">
                    {player.name}
                    {player.is_captain && <CaptainMark compact />}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    Drove
                  </span>
                </div>
              );
            }

            return (
              <button
                key={player.id}
                type="button"
                onClick={() => onToggleShared(player.id)}
                className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <span
                  className={cn(
                    "flex size-[22px] shrink-0 items-center justify-center rounded-sm border-[1.5px]",
                    on
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border-strong bg-surface",
                  )}
                >
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="flex flex-1 items-center gap-1.5 text-sm font-medium text-text-primary">
                  {player.name}
                  {player.is_captain && <CaptainMark compact />}
                </span>
              </button>
            );
          })}

          {guests.map((guest, i) => {
            if (guest.brought_car) {
              return (
                <div
                  key={`g${i}`}
                  className="flex min-h-11 items-center gap-3 px-4 py-2.5 opacity-50"
                >
                  <span className="flex size-[22px] shrink-0 items-center justify-center">
                    <Car size={16} className="text-accent" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-text-primary">
                    {guest.name}
                    <span className="ml-1.5 text-xs text-text-muted">guest</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    Drove
                  </span>
                </div>
              );
            }
            return (
              <button
                key={`g${i}`}
                type="button"
                onClick={() => onToggleGuestShared(i)}
                className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <span
                  className={cn(
                    "flex size-[22px] shrink-0 items-center justify-center rounded-sm border-[1.5px]",
                    guest.shared_car
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border-strong bg-surface",
                  )}
                >
                  {guest.shared_car && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="flex-1 text-sm font-medium text-text-primary">
                  {guest.name}
                  <span className="ml-1.5 text-xs text-text-muted">guest</span>
                </span>
              </button>
            );
          })}

          {players.length === 0 && guests.length === 0 && (
            <p className="px-4 py-3 text-sm text-text-muted">
              Nobody to list yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
