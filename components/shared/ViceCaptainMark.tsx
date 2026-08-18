import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

// The vice-captain's mark: "VC" in a circle, rendered right after
// the vice-captain's name wherever players are listed. No crown —
// that stays reserved for the captain.
export function ViceCaptainMark({ className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-silver-light px-1 text-[9px] font-bold leading-none text-silver-foreground",
        className,
      )}
      title="Vice-captain"
      aria-label="Vice-captain"
    >
      VC
    </span>
  );
}
