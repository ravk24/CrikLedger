import Link from "next/link";
import { Trophy } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TournamentPublic } from "@/types";

type Props = {
  tournament: TournamentPublic;
};

function subtitle(t: TournamentPublic): string {
  const parts: string[] = [];
  if (t.team_name) parts.push(t.team_name);
  if (t.venue) parts.push(t.venue);
  if (t.start_date) {
    parts.push(
      t.end_date
        ? `${formatDateShort(t.start_date)} – ${formatDateShort(t.end_date)}`
        : formatDateShort(t.start_date),
    );
  }
  parts.push(`${t.player_count} ${t.player_count === 1 ? "player" : "players"}`);
  return parts.join(" · ");
}

// Name and subtitle only — no fund balance on the directory card (Ravi
// 2026-08-25); the balance lives inside the tournament.
export function TournamentCard({ tournament }: Props) {
  const completed = tournament.status === "completed";
  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className={cn(
        "flex min-h-11 items-center gap-3 px-4 py-3",
        completed && "bg-surface-secondary",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          completed
            ? "bg-inactive-light text-inactive-foreground"
            : "bg-low-light text-low-foreground",
        )}
      >
        <Trophy size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-semibold",
            completed ? "text-text-muted" : "text-text-primary",
          )}
        >
          {tournament.name}
        </span>
        <span className="block truncate text-xs text-text-muted">
          {subtitle(tournament)}
        </span>
      </span>
    </Link>
  );
}
