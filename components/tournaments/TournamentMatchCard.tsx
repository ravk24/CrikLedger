import Link from "next/link";
import { matchState, ResultBadge } from "@/components/shared/ResultBadge";
import { formatDateShort, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TournamentMatch } from "@/types";

type Props = {
  match: TournamentMatch;
  attendeeCount: number; // 0 while scheduled
};

// Tournament match card — sibling of the SG MatchCard (no Home/Away
// pill, no venue suffix, no guests; time on the date line instead).
// Card treatment matches MatchCard: scheduled border tint, abandoned
// on the secondary surface.
export function TournamentMatchCard({ match, attendeeCount }: Props) {
  const state = matchState(match);
  return (
    <Link
      href={`/tournaments/${match.tournament_id}/matches/${match.id}`}
      className={cn(
        "block rounded-lg border bg-surface p-4 shadow-card",
        state === "scheduled" ? "border-scheduled-light" : "border-border",
        state === "abandoned" && "bg-surface-secondary",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-base font-semibold text-text-primary">
          vs {match.opponent}
        </span>
        {/* SG convention: no Scheduled badge — the page header says it */}
        {state !== "scheduled" && (
          <span className="flex shrink-0 items-center">
            <ResultBadge match={match} />
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-text-muted">
        {formatDateShort(match.match_date)} · {formatTime(match.match_time)}
        {match.status === "completed" &&
          attendeeCount > 0 &&
          ` · ${attendeeCount} played`}
        {match.status === "abandoned" &&
          match.abandoned_reason &&
          ` · ${match.abandoned_reason}`}
      </p>
    </Link>
  );
}
