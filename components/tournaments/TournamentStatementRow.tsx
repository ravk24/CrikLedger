"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Money } from "@/components/shared/Money";
import { cn } from "@/lib/utils";
import { formatDate, formatDateShort, formatRupees } from "@/lib/format";
import type { TournamentStatementRow } from "@/types";

// One leg of the settlement charge — server-built from
// tournament_fee_breakdown_public, ordered by match_date, match_time.
// Each match has its own rate under the per-match model.
export type FeeMatchLine = {
  matchId: string;
  matchDate: string;
  opponent: string;
  share: number; // charged for that match
  driverCredit: number; // 0 when no car brought
};

export type FeeDetail = {
  played: number;
  driverCredit: number;
  settledAt: string; // tournament_fee_charges.created_at
  // Empty for tournaments settled before migration-25 (no persisted
  // lines) — the panel then shows totals only, never a made-up rate.
  matches: FeeMatchLine[];
};

type Props = {
  row: TournamentStatementRow; // delta/running_balance already Number()
  feeDetail?: FeeDetail; // only for kind === "tournament_fee"
};

// Read-only expandable statement row (LedgerRow pattern — everyone can
// expand, nobody edits here; edits happen from the tournament ledger).
export function StatementRow({ row, feeDetail }: Props) {
  const [expanded, setExpanded] = useState(false);
  // Deposit messages live in the expanded panel, not the title.
  const title = row.kind === "deposit" ? "Deposit" : row.description;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-semibold text-text-primary",
              expanded ? "break-words" : "truncate",
            )}
          >
            {title}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {formatDateShort(row.entry_date)}
            {row.kind === "expense_share" && " · shared expense"}
            {row.kind === "match_fee" && " · match fee"}
            {row.kind === "driver_rebate" && " · driver rebate"}
            {row.kind === "tournament_fee" &&
              (row.delta > 0 ? " · driver credit" : " · settlement")}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className="flex flex-col items-end">
            <Money
              amount={row.delta}
              variant="signed"
              className="text-[15px] font-bold"
            />
            <span className="text-[10px] text-text-muted">
              bal {row.running_balance < 0 ? "−" : ""}₹
              {formatRupees(row.running_balance)}
            </span>
          </span>
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
          {row.kind === "tournament_fee" && feeDetail ? (
            <>
              <p className="text-xs text-text-muted">
                {feeDetail.matches.length > 0
                  ? `Fee across ${feeDetail.played} ${
                      feeDetail.played === 1 ? "match" : "matches"
                    } — each match splits its own cost`
                  : // Settled before migration-25 — no per-match lines
                    // were persisted; show totals only.
                    `Played ${feeDetail.played} ${
                      feeDetail.played === 1 ? "match" : "matches"
                    }`}
              </p>
              {feeDetail.matches.map((m) => (
                <div
                  key={m.matchId}
                  className="flex items-center justify-between gap-3"
                >
                  <p className="min-w-0 truncate text-sm text-text-primary">
                    {formatDateShort(m.matchDate)} · vs {m.opponent}
                  </p>
                  <Money
                    amount={-m.share}
                    variant="signed"
                    className="shrink-0 text-xs font-semibold"
                  />
                </div>
              ))}
              {feeDetail.matches
                .filter((m) => m.driverCredit > 0)
                .map((m) => (
                  <div
                    key={`car-${m.matchId}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <p className="min-w-0 truncate text-sm text-text-primary">
                      Car credit · vs {m.opponent}
                    </p>
                    <Money
                      amount={m.driverCredit}
                      variant="signed"
                      className="shrink-0 text-xs font-semibold"
                    />
                  </div>
                ))}
              <p className="text-xs text-text-muted">
                Settled {formatDate(feeDetail.settledAt)}
              </p>
            </>
          ) : (
            <>
              {row.kind === "deposit" && row.description && (
                <p className="break-words text-sm text-text-primary">
                  {row.description}
                </p>
              )}
              <p className="text-xs text-text-muted">
                {formatDate(row.entry_date)}
                {row.edited_by && <> · entry by {row.edited_by}</>}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
