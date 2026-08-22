export type ScheduledState = "no_opponent" | "fee_pending" | "ready";

// State of a scheduled match, used by the upcoming-list filter.
// Opponent is checked first: a match with nobody to play has nothing
// meaningful to say about its money.
export function scheduledState(
  opponent: string | null,
  feePending: number,
): ScheduledState {
  if (!opponent?.trim()) return "no_opponent";
  if (feePending > 0) return "fee_pending";
  return "ready";
}
