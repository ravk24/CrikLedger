"use client";

import { useState } from "react";
import { Car, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WizardGuest } from "@/components/wizard/wizardTypes";

type Props = {
  guests: WizardGuest[];
  onAddGuest: (name: string) => void;
  onRemoveGuest: (index: number) => void;
  onToggleCar: (index: number) => void;
};

// v2 guest rule: guests count in the fee split and their charges are
// deducted from the captain's balance — guests hand the captain cash
// offline. A guest can bring a car for the same allowance rebate.
export function StepGuests({
  guests,
  onAddGuest,
  onRemoveGuest,
  onToggleCar,
}: Props) {
  const [guestName, setGuestName] = useState("");

  function commitGuest() {
    const name = guestName.trim();
    if (name) onAddGuest(name);
    setGuestName("");
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">
        Guests pay the same per-head fee as players — their total is
        deducted from the captain&apos;s balance (they hand the captain
        cash). Tap the car if a guest drove. Skip ahead if nobody brought
        a guest.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitGuest();
            }
          }}
          placeholder="Guest name"
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={commitGuest}
          className="h-11 shrink-0 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground"
        >
          Add
        </button>
      </div>

      {guests.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface shadow-card p-3">
          {guests.map((guest, i) => (
            <span
              key={`${guest.name}-${i}`}
              className="flex items-center gap-1.5 rounded-full bg-low-light px-2.5 py-1 text-xs font-medium text-low-foreground"
            >
              {guest.name}
              <button
                type="button"
                onClick={() => onToggleCar(i)}
                aria-label={
                  guest.brought_car
                    ? `${guest.name} brought a car — tap to remove`
                    : `Mark ${guest.name} as bringing a car`
                }
                className={cn(
                  "flex size-5 items-center justify-center rounded-full",
                  guest.brought_car
                    ? "bg-accent text-accent-foreground"
                    : "text-text-muted",
                )}
              >
                <Car size={12} />
              </button>
              <button
                type="button"
                onClick={() => onRemoveGuest(i)}
                aria-label={`Remove ${guest.name}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
