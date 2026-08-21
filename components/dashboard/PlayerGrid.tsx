"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { PlayerCard } from "@/components/shared/PlayerCard";
import type { PlayerPublic } from "@/types";

type Props = {
  players: PlayerPublic[];
  hrefBase?: string; // forwarded to PlayerCard; tournaments override it
  emptyCopy?: string;
  // Admin-only "save as image" control, supplied by the server page so
  // the gate never runs on the client.
  downloadSlot?: React.ReactNode;
};

// Searchable player list, active first, inactive greyed at the bottom.
// Players arrive pre-sorted from the server; search filters client-side.
export function PlayerGrid({
  players,
  hrefBase,
  emptyCopy,
  downloadSlot,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const activeCount = players.filter((p) => p.is_active).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players"
          className="h-11 w-full rounded-md border border-border bg-surface-secondary pl-9 pr-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        {downloadSlot}
      </div>

      <div className="flex items-baseline justify-between px-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          Players · {activeCount} active
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          Balance
        </span>
      </div>

      {players.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
          {emptyCopy ?? "No players yet — an admin can add them from the console."}
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
          No players match “{query.trim()}”.
        </p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {filtered.map((player) => (
            <PlayerCard key={player.id} player={player} hrefBase={hrefBase} />
          ))}
        </div>
      )}
    </section>
  );
}
