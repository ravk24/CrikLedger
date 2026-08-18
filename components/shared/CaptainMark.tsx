import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  // compact = crown only, for tight rows (wizard lists, chips).
  compact?: boolean;
  className?: string;
};

// The captain's mark: crown icon + "C" in a circle, rendered right
// after the captain's name wherever players are listed.
export function CaptainMark({ compact = false, className }: Props) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1", className)}
      title="Captain"
      aria-label="Captain"
    >
      <Crown size={14} className="text-gold" />
      {!compact && (
        <span className="flex size-4 items-center justify-center rounded-full bg-gold-light text-[10px] font-bold leading-none text-gold-foreground">
          C
        </span>
      )}
    </span>
  );
}
