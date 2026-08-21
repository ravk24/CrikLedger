import { cn } from "@/lib/utils";

type Props = {
  opponent: string | null;
  feePending: number;
};

// At-a-glance state of a scheduled match, read in this order:
//   red    — no opponent yet (scheduled with the details switch off)
//   orange — opponent known, but part of the fee is still pending
//   green  — opponent known and the fee is fully settled
// Opponent is checked first: a match with nobody to play has nothing
// meaningful to say about its money.
export function MatchStatusDot({ opponent, feePending }: Props) {
  const state = !opponent?.trim()
    ? { className: "bg-debit", label: "No opponent yet" }
    : feePending > 0
      ? { className: "bg-low", label: "Fee pending" }
      : { className: "bg-credit", label: "Opponent set, fee paid" };

  return (
    <span
      role="img"
      aria-label={state.label}
      title={state.label}
      className={cn("size-2.5 shrink-0 rounded-full", state.className)}
    />
  );
}
