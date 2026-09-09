// Pure row shaping for the XLSX export. lib/export/ledgerWorkbook.ts
// turns these shapes into sheets; app/api/export/ledger/route.ts feeds
// them from the views. No ExcelJS and no database here — everything is
// deterministic in → out so it is unit-tested, and a tournament export
// can later map its own views into the same shapes.
//
// Money rule: nothing here computes a fee. The Ledger running balance is
// a cumulative sum of STORED amounts in the order pool_balance sums them
// (every kind counts, migration 9); statement running balances come from
// the player_statement view untouched.

import { opponentLabel } from "@/lib/format";

// Whole history by definition, but bounded: one row past the cap marks
// the sheet INCOMPLETE rather than failing the download.
export const LEDGER_CAP = 5000;
export const STATEMENT_CAP = 20000;

// Whole rupees over the wire, but amounts are NUMERIC(10,2) and pg hands
// those (and bigint aggregates) back as strings — every amount goes
// through this.
function num(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---- Source shapes (what the views return) ----

export type LedgerSource = {
  id: string;
  entry_date: string; // yyyy-mm-dd
  created_at: string; // same-day tiebreak
  kind: string;
  message: string;
  amount: number | string;
  player_name: string | null;
  edited_by: string | null;
  match_id: string | null;
  match_opponent: string | null;
};

export type BalanceSource = {
  id: string;
  name: string;
  is_active: boolean;
  balance: number | string;
  status: string;
  is_captain: boolean;
  is_vice_captain: boolean;
};

export type StatementSource = {
  player_id: string;
  entry_date: string;
  created_at: string;
  kind: string;
  description: string;
  delta: number | string;
  running_balance: number | string;
  match_id: string | null;
  source_id: string;
  edited_by: string | null;
};

// ---- Export shapes (what the sheets render) ----

export type ExportLedgerRow = {
  id: string;
  date: string; // yyyy-mm-dd
  kind: string;
  description: string;
  player: string; // "" when the row has no player
  amount: number;
  running: number;
  match: string; // "" when the row is not a match fee
  enteredBy: string;
};

export type ExportBalanceRow = {
  name: string;
  balance: number;
  status: string;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isActive: boolean;
};

export type ExportStatementRow = {
  player: string;
  date: string;
  kind: string;
  description: string;
  delta: number;
  running: number;
  matchId: string;
  enteredBy: string;
};

// Human labels for the kind column. Unknown kinds fall through as-is so a
// new enum value never breaks an export.
const KIND_LABELS: Record<string, string> = {
  deposit: "Deposit",
  other_income: "Other income",
  ground_booking: "Ground booking",
  equipment: "Equipment",
  match_collection: "Match collection",
  plain_debit: "Debit",
  common_debit: "Common debit",
  opening_due: "Season due",
  expense_recovery: "Expense recovery",
  // player_statement kinds
  match_fee: "Match fee",
  guest_fee: "Guest fees",
  driver_rebate: "Car rebate",
  expense_share: "Common expense",
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

// Same titling rule as components/shared/LedgerRow.tsx and the ledger
// share image: player-linked rows are titled by who they belong to.
export function ledgerTitle(
  row: Pick<LedgerSource, "kind" | "message" | "player_name">,
): string {
  if (row.player_name) {
    if (row.kind === "deposit") return `Deposit by ${row.player_name}`;
    if (row.kind === "opening_due") return `Season due — ${row.player_name}`;
  }
  return row.message;
}

export function matchLabel(
  row: Pick<LedgerSource, "match_id" | "match_opponent">,
): string {
  return row.match_id ? `vs ${opponentLabel(row.match_opponent)}` : "";
}

/**
 * Ledger rows oldest first with a running balance. The order is the one
 * pool_balance implies — entry_date, then created_at, then id as a
 * deterministic last tiebreak — so the final `total` equals the pool
 * balance whenever the input is the whole ledger.
 */
export function withRunningBalance(rows: LedgerSource[]): {
  rows: ExportLedgerRow[];
  total: number;
} {
  const ordered = [...rows].sort(
    (a, b) =>
      cmp(a.entry_date, b.entry_date) ||
      cmp(a.created_at, b.created_at) ||
      cmp(a.id, b.id),
  );
  let running = 0;
  const out = ordered.map((r): ExportLedgerRow => {
    const amount = num(r.amount);
    running += amount;
    return {
      id: r.id,
      date: r.entry_date.slice(0, 10),
      kind: kindLabel(r.kind),
      description: ledgerTitle(r),
      player: r.player_name ?? "",
      amount,
      running,
      match: matchLabel(r),
      enteredBy: r.edited_by ?? "",
    };
  });
  return { rows: out, total: running };
}

// Same order as the Home dashboard and the balances share image: active
// first, biggest debtors on top, names only break ties.
export function sortBalances(players: BalanceSource[]): ExportBalanceRow[] {
  return [...players]
    .sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      const diff = num(a.balance) - num(b.balance);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    })
    .map((p) => ({
      name: p.name,
      balance: num(p.balance),
      status: p.status,
      isCaptain: p.is_captain,
      isViceCaptain: p.is_vice_captain,
      isActive: p.is_active,
    }));
}

/**
 * Statement rows grouped per player (contiguous, so a filter on the
 * Player column is that player's statement), each group in the view's
 * own window order so running_balance reads top to bottom.
 */
export function shapeStatements(
  rows: StatementSource[],
  playersById: ReadonlyMap<string, string>,
): ExportStatementRow[] {
  const nameOf = (id: string) => playersById.get(id) ?? "(unknown player)";
  return [...rows]
    .sort(
      (a, b) =>
        nameOf(a.player_id).localeCompare(nameOf(b.player_id)) ||
        cmp(a.player_id, b.player_id) ||
        cmp(a.entry_date, b.entry_date) ||
        cmp(a.created_at, b.created_at) ||
        cmp(a.source_id, b.source_id),
    )
    .map((r) => ({
      player: nameOf(r.player_id),
      date: r.entry_date.slice(0, 10),
      kind: kindLabel(r.kind),
      description: r.description,
      delta: num(r.delta),
      running: num(r.running_balance),
      matchId: r.match_id ?? "",
      enteredBy: r.edited_by ?? "",
    }));
}

// entry_date is a tz-less DATE. ExcelJS serialises a Date through its UTC
// milliseconds, so building it at UTC midnight lands on the same calendar
// day whatever the server's zone.
export function isoDateToUtc(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function exportFilename(slug: string, isoDay: string): string {
  return `${slug}-ledger-${isoDay}.xlsx`;
}

const exportedAtFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Kolkata",
});

export function exportedAtLabel(now: Date): string {
  return `Exported ${exportedAtFormat.format(now)} IST`;
}
