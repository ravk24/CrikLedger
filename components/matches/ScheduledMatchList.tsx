"use client";

import { useState } from "react";
import { MatchCard } from "@/components/matches/MatchCard";
import {
  SCHEDULED_STATE_META,
  scheduledState,
  type ScheduledState,
} from "@/components/matches/MatchStatusDot";
import { cn } from "@/lib/utils";
import type { Match } from "@/types";

type Props = {
  matches: Match[];
  counts: Record<string, number>;
};

type Filter = "all" | ScheduledState;

const OPTIONS: { value: Filter; label: string }[] = [
  { value: "all", label: "All matches" },
  { value: "ready", label: "Green — opponent set, fee paid" },
  { value: "fee_pending", label: "Orange — fee pending" },
  { value: "no_opponent", label: "Red — no opponent yet" },
];

// The list is small (one team's upcoming matches), so filtering happens
// here on the already-fetched rows rather than round-tripping a query.
export function ScheduledMatchList({ matches, counts }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible =
    filter === "all"
      ? matches
      : matches.filter(
          (m) =>
            scheduledState(m.opponent, Number(m.fee_pending)) === filter,
        );

  return (
    <>
      <label className="flex items-center gap-2">
        <span className="sr-only">Filter by status</span>
        {filter !== "all" && (
          <span
            aria-hidden
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              SCHEDULED_STATE_META[filter].className,
            )}
          />
        )}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
          No {SCHEDULED_STATE_META[filter as ScheduledState]?.label.toLowerCase()} matches.
        </p>
      ) : (
        <section className="flex flex-col gap-2">
          {visible.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              attendeeCount={counts[match.id] ?? 0}
            />
          ))}
        </section>
      )}
    </>
  );
}
