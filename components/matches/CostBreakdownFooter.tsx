import { Money } from "@/components/shared/Money";
import { formatRupees } from "@/lib/format";

// Structural subset — SG Match and TournamentMatch both satisfy it.
type MatchCosts = {
  ground_fee: number;
  ball_fee: number;
  other_fee: number;
  car_allowance_per_car: number;
};

// Structural subset of engine/calc.ts MatchFeeResult. The footer prints
// engine output; it never recomputes a rupee of its own.
type FeeSummary = {
  totalCost: number; // cash + cars
  carCount: number;
  perPlayerFee: number; // base share
  carSharePerSharer: number;
  collectedTotal: number;
  surplusToPool: number;
};

type Props = {
  match: MatchCosts;
  result: FeeSummary;
  fundLabel?: string; // "pool" (SG) or "fund" (tournaments)
};

// Ground · Ball · Cars, then Total / Per head / Collected / Surplus.
// Deliberately no "Own way" or "guest fees via the captain" lines (Ravi
// 2026-08-25): the rows say who paid what, and guests paying the captain
// is a standing team rule.
export function CostBreakdownFooter({
  match,
  result,
  fundLabel = "pool",
}: Props) {
  const allowance = Number(match.car_allowance_per_car);
  const perHead = result.perPlayerFee + result.carSharePerSharer;

  return (
    <section className="rounded-lg border border-border bg-surface-secondary p-4 text-sm">
      <p className="text-xs text-text-secondary">
        Ground ₹{formatRupees(Number(match.ground_fee))} · Ball ₹
        {formatRupees(Number(match.ball_fee))}
        {Number(match.other_fee) > 0 &&
          ` · Other ₹${formatRupees(Number(match.other_fee))}`}
        {result.carCount > 0 &&
          allowance > 0 &&
          ` · Cars ${result.carCount} × ₹${formatRupees(allowance)}`}
      </p>
      <div className="mt-3 flex justify-between">
        <span className="text-text-secondary">Total match cost</span>
        <Money amount={result.totalCost} className="font-semibold" />
      </div>
      <div className="mt-1 flex justify-between">
        <span className="text-text-secondary">Per head</span>
        <Money amount={perHead} className="font-semibold" />
      </div>
      <div className="mt-1 flex justify-between">
        <span className="text-text-secondary">Collected (net of rebates)</span>
        <Money amount={result.collectedTotal} className="font-semibold" />
      </div>
      <div className="mt-1 flex justify-between">
        <span className="font-semibold text-credit">
          Rounding surplus credited to {fundLabel}
        </span>
        <Money
          amount={result.surplusToPool}
          variant="signed"
          className="font-bold"
        />
      </div>
    </section>
  );
}
