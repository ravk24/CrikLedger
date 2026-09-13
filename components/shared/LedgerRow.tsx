"use client";

import { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { Money } from "@/components/shared/Money";
import { cn } from "@/lib/utils";
import { formatDate, formatDateShort } from "@/lib/format";
import type { PoolLedgerRow } from "@/types";

// Structural row — PoolLedgerRow and TournamentLedgerRow both satisfy
// it (tournament ledgers carry kinds the SG pool never uses).
type LedgerEntry = Omit<
  PoolLedgerRow,
  "kind" | "match_id" | "match_opponent" | "match_status"
> & { kind: string };

type Props = {
  entry: LedgerEntry;
  // Present only for admins on editable rows — shown inside the
  // expanded panel. Everyone can expand; only admins can edit.
  onEdit?: () => void;
};

// Auto rows are written only by their owning transaction — locked in the
// UI, no edit affordance ever (ui-rules).
const AUTO_CHIPS: Record<string, string> = {
  match_collection: "AUTO · MATCH",
  match_refund: "AUTO · CANCELLED",
  joining_fee: "AUTO · FEE",
  tournament_collection: "AUTO · SURPLUS",
};

const KIND_CHIPS: Record<string, string> = {
  ground_booking: "BOOKING",
  equipment: "EQUIPMENT",
  opening_due: "SEASON DUE", // player debt carryforward — subtracts from the pool total
};

// Player-linked rows are titled by who they belong to; the admin's
// free-text message becomes the expanded panel's detail instead.
function rowTitle(entry: LedgerEntry): string {
  if (entry.player_name) {
    if (entry.kind === "deposit") return `Deposit by ${entry.player_name}`;
    if (entry.kind === "opening_due")
      return `Season due — ${entry.player_name}`;
  }
  return entry.message;
}

export function LedgerRow({ entry, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const autoChip = AUTO_CHIPS[entry.kind];
  const kindChip = KIND_CHIPS[entry.kind];
  const isCommon = entry.kind === "common_debit";

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-semibold text-text-primary",
                expanded ? "break-words" : "truncate",
              )}
            >
              {rowTitle(entry)}
            </span>
            {autoChip && (
              <span className="flex shrink-0 items-center gap-1 rounded-[4px] bg-inactive-light px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-inactive-foreground">
                <Lock size={10} />
                {autoChip}
              </span>
            )}
            {isCommon && (
              <span className="shrink-0 rounded-[4px] bg-low-light px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-low-foreground">
                COMMON
              </span>
            )}
            {kindChip && (
              <span className="shrink-0 rounded-[4px] bg-credit-light px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-credit-foreground">
                {kindChip}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {formatDateShort(entry.entry_date)}
            {entry.edited_by && <> · {entry.edited_by}</>}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <Money
            amount={entry.amount}
            variant="signed"
            className="text-[15px] font-bold"
          />
          <ChevronDown
            size={16}
            className={cn(
              "text-text-muted transition-transform",
              expanded && "rotate-180",
            )}
          />
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 bg-surface-secondary px-4 py-3">
          {entry.message && (
            <p className="break-words text-sm text-text-primary">
              {entry.message}
            </p>
          )}
          <p className="text-xs text-text-muted">
            {formatDate(entry.entry_date)}
            {entry.edited_by && <> · entry by {entry.edited_by}</>}
          </p>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="h-10 w-full rounded-md border border-border bg-surface shadow-card text-sm font-medium text-accent"
            >
              Edit entry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
