import type { PoolEntryKind } from "@/types";

// The one place that says which ledger kinds an admin may hand-edit,
// which ones name a player, and which ones are stored negative. Routes,
// sheets and the ledger row all read these lists so a new kind
// (withdrawal, migration 55) is wired in once.
//
// The tournament ledger (tournament_entries, migration 56) uses the
// same manual kinds minus opening_due, plus its own auto rows
// joining_fee / tournament_collection — which are simply not in
// MANUAL_KINDS, so these helpers serve both ledgers unchanged.

// Rows an admin may edit or delete from the ledger. Everything else
// (match_collection, match_refund, expense_recovery) changes only
// through its source and the server refuses with 409 AUTO_ENTRY.
export const MANUAL_KINDS: readonly PoolEntryKind[] = [
  "deposit",
  "other_income",
  "equipment",
  "ground_booking",
  "plain_debit",
  "common_debit",
  "opening_due",
  "withdrawal",
];

// Rows that carry player_id and title themselves from the player, so
// their message may be empty.
export const PLAYER_LINKED_KINDS: readonly PoolEntryKind[] = [
  "deposit",
  "opening_due",
  "withdrawal",
];

// Manual rows stored negative: the admin types a positive amount and
// the server (create and edit) flips the sign.
export const NEGATIVE_MANUAL_KINDS: readonly PoolEntryKind[] = [
  "plain_debit",
  "common_debit",
  "opening_due",
  "withdrawal",
];

export function isManualKind(kind: string): boolean {
  return (MANUAL_KINDS as readonly string[]).includes(kind);
}

export function isPlayerLinked(kind: string | null | undefined): boolean {
  return kind != null && (PLAYER_LINKED_KINDS as readonly string[]).includes(kind);
}

export function isNegativeManual(kind: string): boolean {
  return (NEGATIVE_MANUAL_KINDS as readonly string[]).includes(kind);
}

// Ledger title for a row. Player-linked kinds name the player; every
// other kind shows its message. Shared by <LedgerRow> and the ledger
// share image so both read the same.
export function ledgerRowTitle(entry: {
  kind: string;
  player_name: string | null;
  message: string;
}): string {
  if (entry.player_name) {
    if (entry.kind === "deposit") return `Deposit by ${entry.player_name}`;
    if (entry.kind === "withdrawal") return `Withdrawal by ${entry.player_name}`;
    if (entry.kind === "opening_due") return `Season due — ${entry.player_name}`;
  }
  return entry.message;
}

// ---- Ledger filter (team /pool, 2026-10-23) ----
//
// One dropdown narrows the ledger to a single kind of entry. The filter
// runs in the server query (the ledger is paged at 50, so a browser-side
// filter would miss older pages) and travels in `?kind=`. Match fees
// have no kind of their own — a scheduled match's fee row is plain_debit
// (or other_income for "credit to pool") and only the match link in
// pool_ledger_public (match_id) tells it from a hand-entered expense —
// so a filter may also require or exclude that link.
export type LedgerFilter =
  | "all"
  | "deposit"
  | "match_collection"
  | "match_fee"
  | "expense"
  | "common_expense"
  | "withdrawal"
  | "season_due"
  | "other_income";

export type LedgerFilterDef = {
  value: LedgerFilter;
  label: string;
  // null = any kind (the match link alone decides, or no restriction).
  kinds: readonly PoolEntryKind[] | null;
  // true = only rows linked to a match (fee rows + abandon refunds);
  // false = only rows without a match link; undefined = either.
  matchLinked?: boolean;
};

export const LEDGER_FILTERS: readonly LedgerFilterDef[] = [
  { value: "all", label: "All entries", kinds: null },
  { value: "deposit", label: "Deposits", kinds: ["deposit"] },
  { value: "match_collection", label: "Match collections", kinds: ["match_collection"] },
  { value: "match_fee", label: "Match fees", kinds: null, matchLinked: true },
  { value: "expense", label: "Expenses", kinds: ["plain_debit"], matchLinked: false },
  { value: "common_expense", label: "Common expenses", kinds: ["common_debit"] },
  { value: "withdrawal", label: "Withdrawals", kinds: ["withdrawal"] },
  { value: "season_due", label: "Season dues", kinds: ["opening_due"] },
  { value: "other_income", label: "Other income", kinds: ["other_income"], matchLinked: false },
];

export function ledgerFilterDef(filter: LedgerFilter): LedgerFilterDef {
  return LEDGER_FILTERS.find((f) => f.value === filter) ?? LEDGER_FILTERS[0];
}

// `?kind=` straight from the URL: anything unknown is "all", never an
// error page.
export function parseLedgerFilter(raw: string | undefined | null): LedgerFilter {
  if (!raw) return "all";
  return LEDGER_FILTERS.some((f) => f.value === raw) ? (raw as LedgerFilter) : "all";
}

// The same predicate the server query expresses, for the client: an
// optimistic row that would not survive the active filter is not shown.
export function rowMatchesFilter(
  row: { kind: string; match_id: string | null },
  filter: LedgerFilter,
): boolean {
  const def = ledgerFilterDef(filter);
  if (def.kinds && !(def.kinds as readonly string[]).includes(row.kind)) return false;
  if (def.matchLinked === true && row.match_id == null) return false;
  if (def.matchLinked === false && row.match_id != null) return false;
  return true;
}
