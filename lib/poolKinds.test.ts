import { describe, expect, it } from "vitest";
import type { PoolEntryKind } from "@/types";
import {
  LEDGER_FILTERS,
  MANUAL_KINDS,
  NEGATIVE_MANUAL_KINDS,
  PLAYER_LINKED_KINDS,
  isManualKind,
  isNegativeManual,
  isPlayerLinked,
  ledgerRowTitle,
  parseLedgerFilter,
  rowMatchesFilter,
} from "./poolKinds";

// These lists gate what the edit route accepts and which sign it
// stores, so they are pinned: a kind missing from NEGATIVE_MANUAL_KINDS
// would flip positive on its first edit.
describe("kind lists", () => {
  it("every player-linked kind is manual", () => {
    for (const kind of PLAYER_LINKED_KINDS) {
      expect(MANUAL_KINDS).toContain(kind);
    }
  });

  it("withdrawal is manual, player-linked and negative", () => {
    expect(isManualKind("withdrawal")).toBe(true);
    expect(isPlayerLinked("withdrawal")).toBe(true);
    expect(isNegativeManual("withdrawal")).toBe(true);
  });

  it("deposit is player-linked but positive", () => {
    expect(isPlayerLinked("deposit")).toBe(true);
    expect(isNegativeManual("deposit")).toBe(false);
  });

  it("auto kinds are not manual", () => {
    expect(isManualKind("match_collection")).toBe(false);
    expect(isManualKind("match_refund")).toBe(false);
    expect(isManualKind("expense_recovery")).toBe(false);
  });

  // The tournament ledger (migration 56) reuses these helpers: its own
  // settlement rows must stay locked, its manual kinds editable.
  it("tournament auto kinds are not manual; its manual kinds are", () => {
    expect(isManualKind("joining_fee")).toBe(false);
    expect(isManualKind("tournament_collection")).toBe(false);
    for (const kind of ["deposit", "other_income", "plain_debit", "common_debit", "withdrawal"]) {
      expect(isManualKind(kind)).toBe(true);
    }
  });

  it("negative manual kinds are exactly the four", () => {
    expect([...NEGATIVE_MANUAL_KINDS].sort()).toEqual(
      ["common_debit", "opening_due", "plain_debit", "withdrawal"].sort(),
    );
  });

  it("isPlayerLinked tolerates a missing kind", () => {
    expect(isPlayerLinked(null)).toBe(false);
    expect(isPlayerLinked(undefined)).toBe(false);
  });
});

describe("ledgerRowTitle", () => {
  const player = "Abhishek Khare";

  it("names the depositor", () => {
    expect(
      ledgerRowTitle({ kind: "deposit", player_name: player, message: "" }),
    ).toBe("Deposit by Abhishek Khare");
  });

  it("names the player taking money out", () => {
    expect(
      ledgerRowTitle({
        kind: "withdrawal",
        player_name: player,
        message: "Stake returned",
      }),
    ).toBe("Withdrawal by Abhishek Khare");
  });

  it("names the player carrying a season due", () => {
    expect(
      ledgerRowTitle({ kind: "opening_due", player_name: player, message: "" }),
    ).toBe("Season due — Abhishek Khare");
  });

  it("falls back to the message for every other kind", () => {
    expect(
      ledgerRowTitle({
        kind: "plain_debit",
        player_name: null,
        message: "New balls",
      }),
    ).toBe("New balls");
  });

  it("uses the message when a player-linked row has no player name", () => {
    expect(
      ledgerRowTitle({ kind: "deposit", player_name: null, message: "Cash" }),
    ).toBe("Cash");
  });
});

describe("ledger filter", () => {
  const ALL_KINDS: PoolEntryKind[] = [
    "deposit",
    "other_income",
    "ground_booking",
    "equipment",
    "match_collection",
    "match_refund",
    "expense_recovery",
    "plain_debit",
    "common_debit",
    "opening_due",
    "withdrawal",
  ];

  it("every filter names only real kinds, and 'all' is first", () => {
    expect(LEDGER_FILTERS[0].value).toBe("all");
    for (const f of LEDGER_FILTERS) {
      for (const kind of f.kinds ?? []) expect(ALL_KINDS).toContain(kind);
    }
  });

  it("parses the URL value and falls back to all", () => {
    expect(parseLedgerFilter("deposit")).toBe("deposit");
    expect(parseLedgerFilter("junk")).toBe("all");
    expect(parseLedgerFilter(undefined)).toBe("all");
    expect(parseLedgerFilter("")).toBe("all");
  });

  it("tells a match fee from a hand-entered expense by the match link", () => {
    const fee = { kind: "plain_debit", match_id: "m1" };
    const expense = { kind: "plain_debit", match_id: null };
    expect(rowMatchesFilter(fee, "match_fee")).toBe(true);
    expect(rowMatchesFilter(fee, "expense")).toBe(false);
    expect(rowMatchesFilter(expense, "expense")).toBe(true);
    expect(rowMatchesFilter(expense, "match_fee")).toBe(false);
  });

  it("abandon refunds count as match fees; collections do not", () => {
    expect(rowMatchesFilter({ kind: "match_refund", match_id: "m1" }, "match_fee")).toBe(true);
    expect(rowMatchesFilter({ kind: "match_collection", match_id: null }, "match_fee")).toBe(false);
    expect(rowMatchesFilter({ kind: "match_collection", match_id: null }, "match_collection")).toBe(true);
  });

  it("'all' admits every kind, legacy ones included", () => {
    for (const kind of ALL_KINDS) {
      expect(rowMatchesFilter({ kind, match_id: null }, "all")).toBe(true);
    }
    expect(rowMatchesFilter({ kind: "equipment", match_id: null }, "expense")).toBe(false);
  });
});
