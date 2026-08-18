import { Money } from "@/components/shared/Money";
import { formatRupees } from "@/lib/format";

// Structural subset — SG Match and TournamentMatch both satisfy it.
type MatchCosts = {
  ground_fee: number;
  ball_fee: number;
  other_fee: number;
  car_allowance_per_car: number;
};

type Props = {
  match: MatchCosts;
  carCount: number; // player + guest cars — all join the pot
  collectedTotal: number; // all fee rows incl. the captain's guest charge
  guestFee?: number;
  captainName?: string | null;
  fundLabel?: string; // "pool" (SG) or "fund" (tournaments)
};

export function CostBreakdownFooter({
  match,
  carCount,
  collectedTotal,
  guestFee = 0,
  captainName = null,
  fundLabel = "pool",
}: Props) {
  const totalCost =
    Number(match.ground_fee) +
    Number(match.ball_fee) +
    Number(match.other_fee) +
    carCount * Number(match.car_allowance_per_car);
  // Drivers are already netted inside collectedTotal, and the pool pays
  // car allowances out of it — so surplus compares against cash costs only.
  const cashCosts = totalCost - carCount * Number(match.car_allowance_per_car);
  const surplus = collectedTotal - cashCosts;

  return (
    <section className="rounded-lg border border-border bg-surface-secondary p-4 text-sm">
      <p className="text-xs text-text-secondary">
        Ground ₹{formatRupees(Number(match.ground_fee))} · Balls ₹
        {formatRupees(Number(match.ball_fee))} · Other ₹
        {formatRupees(Number(match.other_fee))} · Cars {carCount} × ₹
        {formatRupees(Number(match.car_allowance_per_car))}
      </p>
      <div className="mt-3 flex justify-between">
        <span className="text-text-secondary">Total match cost</span>
        <Money amount={totalCost} className="font-semibold" />
      </div>
      <div className="mt-1 flex justify-between">
        <span className="text-text-secondary">Collected (net of rebates)</span>
        <Money amount={collectedTotal} className="font-semibold" />
      </div>
      {guestFee !== 0 && captainName && (
        <div className="mt-1 flex justify-between">
          <span className="text-text-secondary">
            Guest fees via {captainName}
          </span>
          {/* signed: a guest-driver credit must not render as a charge */}
          <Money amount={guestFee} variant="signed" className="font-semibold" />
        </div>
      )}
      <div className="mt-1 flex justify-between">
        {surplus >= 0 ? (
          <>
            <span className="font-semibold text-credit">
              Rounding surplus credited to {fundLabel}
            </span>
            <Money amount={surplus} variant="signed" className="font-bold" />
          </>
        ) : (
          <>
            <span className="font-semibold text-low">
              Below cost — no {fundLabel} credit
            </span>
            <Money
              amount={surplus}
              variant="balance"
              className="font-bold text-low"
            />
          </>
        )}
      </div>
    </section>
  );
}
