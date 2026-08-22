"use client";

import { useState } from "react";
import { MatchCard } from "@/components/matches/MatchCard";
import { scheduledState } from "@/components/matches/scheduledState";
import { formatMonth } from "@/lib/format";
import type { Match } from "@/types";

type Props = {
  matches: Match[];
  counts: Record<string, number>;
};

type Filter = "all" | "no_opponent" | "fee_pending";

const OPTIONS: { value: Filter; label: string }[] = [
  { value: "all", label: "All matches" },
  { value: "no_opponent", label: "No Opponent" },
  { value: "fee_pending", label: "Pending Fee" },
];

const EMPTY: Record<Filter, string> = {
  all: "No scheduled matches.",
  no_opponent: "No matches without an opponent.",
  fee_pending: "No matches with a pending fee.",
};

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
        <span className="sr-only">Filter matches</span>
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
          {EMPTY[filter]}
        </p>
      ) : (
        <section className="flex flex-col gap-2">
          {groupByMonth(visible).map(([month, rows]) => (
            <div key={month} className="flex flex-col gap-2">
              <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {month}
              </h2>
              {rows.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  attendeeCount={counts[match.id] ?? 0}
                />
              ))}
            </div>
          ))}
        </section>
      )}
    </>
  );
}

// Rows arrive sorted by date, so consecutive runs share a month; the
// label is computed in IST like every other date on the page.
function groupByMonth(rows: Match[]): [string, Match[]][] {
  const groups: [string, Match[]][] = [];
  for (const m of rows) {
    const label = formatMonth(m.match_date);
    const last = groups[groups.length - 1];
    if (last && last[0] === label) last[1].push(m);
    else groups.push([label, [m]]);
  }
  return groups;
}
