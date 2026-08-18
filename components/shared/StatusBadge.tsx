import { cn } from "@/lib/utils";
import type { PlayerStatus } from "@/types";

type Props = {
  status: PlayerStatus;
  className?: string;
};

const STYLES: Record<PlayerStatus, string> = {
  surplus: "bg-credit-light text-credit-foreground",
  low: "bg-low-light text-low-foreground",
  debt: "bg-debit-light text-debit-foreground",
  inactive: "bg-inactive-light text-inactive-foreground",
};

const LABELS: Record<PlayerStatus, string> = {
  surplus: "Surplus",
  low: "Low",
  debt: "In debt",
  inactive: "Inactive",
};

export function StatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium motion-safe:transition-colors motion-safe:duration-300",
        STYLES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}
