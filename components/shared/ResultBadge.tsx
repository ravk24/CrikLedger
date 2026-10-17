import { cn } from "@/lib/utils";
import type { Match } from "@/types";

type MatchState = "won" | "lost" | "tie" | "abandoned" | "scheduled";

type Props = {
  match: Pick<Match, "status" | "result">;
  className?: string;
};

const STYLES: Record<MatchState, string> = {
  won: "bg-credit-light text-credit-foreground",
  lost: "bg-debit-light text-debit-foreground",
  // Amber: neither outcome, and grey already means Abandoned.
  tie: "bg-low-light text-low-foreground",
  abandoned: "bg-inactive-light text-inactive-foreground",
  scheduled: "bg-scheduled-light text-scheduled-foreground",
};

const LABELS: Record<MatchState, string> = {
  won: "Won",
  lost: "Lost",
  tie: "Tie",
  abandoned: "Abandoned",
  scheduled: "Scheduled",
};

export function matchState(match: Pick<Match, "status" | "result">): MatchState {
  if (match.status === "completed") {
    if (match.result === "won") return "won";
    if (match.result === "tie") return "tie";
    return "lost";
  }
  if (match.status === "abandoned") return "abandoned";
  return "scheduled";
}

export function ResultBadge({ match, className }: Props) {
  const state = matchState(match);
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium motion-safe:transition-colors motion-safe:duration-300",
        STYLES[state],
        className,
      )}
    >
      {LABELS[state]}
    </span>
  );
}
