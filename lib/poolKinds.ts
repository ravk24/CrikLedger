import type { PoolEntryKind } from "@/types";

// The one place that says which team-pool ledger kinds an admin may
// hand-edit, which ones name a player, and which ones are stored
// negative. Routes, sheets and the ledger row all read these lists so
// a new kind (withdrawal, migration 55) is wired in once.

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
