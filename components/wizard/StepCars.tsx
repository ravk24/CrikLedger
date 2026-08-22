"use client";

import { Switch } from "@/components/ui/switch";
import { CaptainMark } from "@/components/shared/CaptainMark";
import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WizardPlayer } from "@/components/wizard/wizardTypes";

type Props = {
  players: WizardPlayer[]; // selected players only
  cars: Set<string>;
  onToggleCar: (playerId: string) => void;
  allowance: number;
};

export function StepCars({ players, cars, onToggleCar, allowance }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">
        One car per player — each driver gets a ₹{formatRupees(allowance)}{" "}
        rebate off their fee.
      </p>
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        <div className="max-h-60 divide-y divide-border overflow-y-auto">
        {players.map((player) => {
          const hasCar = cars.has(player.id);
          return (
            <div
              key={player.id}
              className={cn("px-4 py-2.5", hasCar && "bg-accent-light/30")}
            >
              <div className="flex min-h-9 items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                  {player.name}
                  {player.is_captain && <CaptainMark compact />}
                </span>
                <Switch
                  checked={hasCar}
                  onCheckedChange={() => onToggleCar(player.id)}
                />
              </div>
              {hasCar && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  Car · ₹{formatRupees(allowance)} rebate
                </p>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
