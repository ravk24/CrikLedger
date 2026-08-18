import Link from "next/link";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { Money } from "@/components/shared/Money";
import { CaptainMark } from "@/components/shared/CaptainMark";
import { ViceCaptainMark } from "@/components/shared/ViceCaptainMark";
import type { PlayerPublic } from "@/types";

type Props = {
  player: PlayerPublic;
  hrefBase?: string; // statement route prefix; tournaments override it
};

const AVATAR_STYLES: Record<PlayerPublic["status"], string> = {
  surplus: "bg-accent-light text-accent",
  low: "bg-low-light text-low-foreground",
  debt: "bg-debit-light text-debit-foreground",
  inactive: "bg-inactive-light text-inactive-foreground",
};

const BALANCE_LABELS: Partial<Record<PlayerPublic["status"], string>> = {
  low: "LOW",
  debt: "IN DEBT",
};

// Dashboard list row (mockup direction 1a). Whole row links to the
// player's public statement.
export function PlayerCard({ player, hrefBase = "/players" }: Props) {
  const inactive = !player.is_active;
  const label = BALANCE_LABELS[player.status];

  return (
    <Link
      href={`${hrefBase}/${player.id}`}
      className={cn(
        "flex min-h-11 items-center gap-3 px-4 py-3",
        inactive && "bg-surface-secondary",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          AVATAR_STYLES[player.status],
        )}
      >
        {initials(player.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "flex items-center gap-1.5 truncate text-sm font-semibold",
            inactive ? "text-text-muted" : "text-text-primary",
          )}
        >
          {player.name}
          {player.is_captain && <CaptainMark />}
          {player.is_vice_captain && <ViceCaptainMark />}
          {inactive && <span className="font-normal text-text-muted"> · Left</span>}
        </span>
      </span>
      <span className="flex flex-col items-end">
        <Money
          amount={player.balance}
          variant="balance"
          className={cn("text-base font-bold", inactive && "text-text-muted")}
        />
        {label && !inactive && (
          <span
            className={cn(
              "text-[10px] font-bold tracking-wide",
              player.status === "low" ? "text-low" : "text-debit",
            )}
          >
            {label}
          </span>
        )}
      </span>
    </Link>
  );
}
