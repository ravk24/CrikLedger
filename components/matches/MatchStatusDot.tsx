import { cn } from "@/lib/utils";

type Props = {
  opponent: string | null;
  feePending: number;
};

export type ScheduledState = "no_opponent" | "fee_pending" | "ready";

// At-a-glance state of a scheduled match, read in this order:
//   red    — no opponent yet (scheduled with the details switch off)
//   orange — opponent known, but part of the fee is still pending
//   green  — opponent known and the fee is fully settled
// Opponent is checked first: a match with nobody to play has nothing
// meaningful to say about its money. Shared with the list filter so the
// dropdown and the dot can never disagree.
export function scheduledState(
  opponent: string | null,
  feePending: number,
): ScheduledState {
  if (!opponent?.trim()) return "no_opponent";
  if (feePending > 0) return "fee_pending";
  return "ready";
}

export const SCHEDULED_STATE_META: Record<
  ScheduledState,
  { className: string; label: string }
> = {
  no_opponent: { className: "bg-debit", label: "No opponent yet" },
  fee_pending: { className: "bg-low", label: "Fee pending" },
  ready: { className: "bg-credit", label: "Opponent set, fee paid" },
};

export function MatchStatusDot({ opponent, feePending }: Props) {
  const state = SCHEDULED_STATE_META[scheduledState(opponent, feePending)];

  return (
    <span
      role="img"
      aria-label={state.label}
      title={state.label}
      className={cn("size-2.5 shrink-0 rounded-full", state.className)}
    />
  );
}
