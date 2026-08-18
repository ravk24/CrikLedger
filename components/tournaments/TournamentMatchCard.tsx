import Link from "next/link";
import { ResultBadge } from "@/components/shared/ResultBadge";
import { formatDateShort, formatTime } from "@/lib/format";
import type { TournamentMatch } from "@/types";

type Props = {
  match: TournamentMatch;
  attendeeCount: number; // 0 while scheduled
};

// Tournament match card — sibling of the SG MatchCard (no Home/Away
// pill, no venue suffix, no guests; time on the date line instead).
export function TournamentMatchCard({ match, attendeeCount }: Props) {
  return (
    <Link
      href={`/tournaments/${match.tournament_id}/matches/${match.id}`}
      className="flex min-h-11 items-center justify-between gap-3 px-4 py-3"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 truncate text-sm font-semibold text-text-primary">
          vs {match.opponent}
          {/* SG convention: no Scheduled badge — the section header says it */}
          {match.status !== "scheduled" && <ResultBadge match={match} />}
        </span>
        <span className="mt-0.5 block text-xs text-text-muted">
          {formatDateShort(match.match_date)} · {formatTime(match.match_time)}
          {match.status === "completed" &&
            attendeeCount > 0 &&
            ` · ${attendeeCount} played`}
        </span>
      </span>
    </Link>
  );
}
