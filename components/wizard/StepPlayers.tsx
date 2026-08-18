"use client";

import { useState } from "react";
import { Check, Search } from "lucide-react";
import { CaptainMark } from "@/components/shared/CaptainMark";
import { cn } from "@/lib/utils";
import type { WizardPlayer } from "@/components/wizard/wizardTypes";

type Props = {
  players: WizardPlayer[];
  selected: Set<string>;
  onToggle: (playerId: string) => void;
};

export function StepPlayers({ players, selected, onToggle }: Props) {
  const [query, setQuery] = useState("");
  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search active players"
            className="h-11 w-full rounded-md border border-border bg-surface-secondary pl-9 pr-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <span className="ml-3 shrink-0 rounded-full bg-text-primary px-3 py-1 text-xs font-bold text-surface">
          {selected.size} selected
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="max-h-60 divide-y divide-border overflow-y-auto">
        {filtered.map((player) => {
          const checked = selected.has(player.id);
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => onToggle(player.id)}
              className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left"
            >
              <span
                className={cn(
                  "flex size-[22px] shrink-0 items-center justify-center rounded-sm border-[1.5px]",
                  checked
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border-strong bg-surface",
                )}
              >
                {checked && <Check size={14} strokeWidth={3} />}
              </span>
              <span
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium",
                  checked ? "text-text-primary" : "text-text-secondary",
                )}
              >
                {player.name}
                {player.is_captain && <CaptainMark compact />}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-4 text-sm text-text-muted">No players match.</p>
        )}
        </div>
      </div>
    </div>
  );
}
