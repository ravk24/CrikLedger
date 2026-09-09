import { Medal } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  // compact = medal only, for tight rows (wizard lists, chips).
  compact?: boolean;
  className?: string;
};

// The vice-captain's mark: medal icon + "VC" in a circle, rendered right
// after the vice-captain's name wherever players are listed. Same shape
// as CaptainMark so the two read as a pair; silver where the captain is
// gold. The crown stays reserved for the captain.
export function ViceCaptainMark({ compact = false, className }: Props) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1", className)}
      title="Vice-captain"
      aria-label="Vice-captain"
    >
      <Medal size={14} className="text-silver" />
      {!compact && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-silver-light px-1 text-[9px] font-bold leading-none text-silver-foreground">
          VC
        </span>
      )}
    </span>
  );
}
