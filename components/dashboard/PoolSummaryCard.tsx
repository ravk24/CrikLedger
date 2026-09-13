import { AnimatedRupees } from "@/components/dashboard/AnimatedRupees";

type Props = {
  balance: number;
  entryCount: number;
  label?: string; // card heading; tournaments pass "Tournament fund"
};

export function PoolSummaryCard({
  balance,
  entryCount,
  label = "Team pool",
}: Props) {
  return (
    <section className="rounded-lg bg-chrome p-4 text-chrome-foreground shadow-card">
      <p className="text-[11px] font-bold uppercase tracking-wider text-chrome-muted">
        {label}
      </p>
      <p className="mt-1">
        <AnimatedRupees
          value={balance}
          className="text-[32px] font-bold leading-9"
        />
      </p>
      <p className="mt-1 text-xs text-chrome-muted">
        {entryCount} {entryCount === 1 ? "entry" : "entries"} in the ledger
      </p>
    </section>
  );
}
