import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { ResultBadge, matchState } from "@/components/shared/ResultBadge";
import type { Match } from "@/types";

type Props = {
  match: Match;
  attendeeCount: number;
};

export function MatchCard({ match, attendeeCount }: Props) {
  const state = matchState(match);
  const isBarne = match.ground === "barne";

  return (
    <Link
      href={`/matches/${match.id}`}
      className={cn(
        "block rounded-lg border bg-surface p-4",
        state === "scheduled" ? "border-scheduled-light" : "border-border",
        state === "abandoned" && "bg-surface-secondary",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-base font-semibold text-text-primary">
          vs {match.opponent}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              isBarne
                ? "bg-scheduled-light text-scheduled-foreground"
                : "bg-inactive-light text-inactive-foreground",
            )}
          >
            {isBarne ? "Barne" : "Other"}
          </span>
          {state !== "scheduled" && <ResultBadge match={match} />}
        </span>
      </div>
      <p className="mt-1 text-xs text-text-muted">
        {formatDate(match.match_date)}
        {!isBarne && match.venue && (
          <>
            {" · "}
            {match.venue}
          </>
        )}
        {match.status === "completed" && (
          <>
            {" · "}
            {attendeeCount} {attendeeCount === 1 ? "attendee" : "attendees"}
          </>
        )}
        {match.status === "abandoned" && match.abandoned_reason && (
          <>
            {" · "}
            {match.abandoned_reason}
          </>
        )}
      </p>
    </Link>
  );
}
