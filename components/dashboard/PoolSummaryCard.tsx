import { AnimatedRupees } from "@/components/dashboard/AnimatedRupees";

import { formatRupees } from "@/lib/format";

type Props = {
  balance: number;
  entryCount: number;
  lastCollection?: number | null;
  label?: string; // card heading; tournaments pass "Tournament fund"
};

export function PoolSummaryCard({
  balance,
  entryCount,
  lastCollection,
  label = "Team pool",
}: Props) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-2">
        <AnimatedRupees
          value={balance}
          className="text-[32px] font-bold leading-9"
        />
        {lastCollection != null && lastCollection > 0 && (
          <span className="rounded-full bg-credit-light px-2 py-0.5 text-xs font-medium text-credit-foreground">
            +₹{formatRupees(lastCollection)} last match surplus
          </span>
        )}
      </p>
      <p className="mt-1 text-xs text-text-muted">
        {entryCount} {entryCount === 1 ? "entry" : "entries"} in the ledger
      </p>
    </section>
  );
}
