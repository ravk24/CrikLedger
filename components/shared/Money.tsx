import { cn } from "@/lib/utils";
import { formatRupees } from "@/lib/format";

type Props = {
  amount: number;
  /**
   * neutral — plain ₹, text-text-primary (cost inputs, breakdown totals)
   * signed  — +₹ green / −₹ red (ledger rows, statement amounts)
   * balance — colored by sign, − only when negative (balances, pool totals)
   */
  variant?: "neutral" | "signed" | "balance";
  className?: string;
};

export function Money({ amount, variant = "neutral", className }: Props) {
  const negative = amount < 0;
  const value = formatRupees(amount);

  let prefix = "₹";
  let color = "text-text-primary";
  if (variant === "signed") {
    prefix = negative ? "−₹" : "+₹";
    color = negative ? "text-debit" : "text-credit";
  } else if (variant === "balance") {
    prefix = negative ? "−₹" : "₹";
    color = negative ? "text-debit" : "text-credit";
  }

  return (
    <span className={cn("tabular-nums", color, className)}>
      {prefix}
      {value}
    </span>
  );
}
