import { formatFee } from "@/lib/format";
import { cn } from "@/lib/utils";

// A per-person match fee: "₹5" to pay, "gets ₹53" when the team owes
// them (a driver whose rebate beat their share). Credit colour for the
// latter, no bare sign either way — see formatFee.
export function FeeAmount({
  fee,
  className,
}: {
  fee: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        fee < 0 ? "text-credit" : "text-text-primary",
        className,
      )}
    >
      {formatFee(fee)}
    </span>
  );
}
