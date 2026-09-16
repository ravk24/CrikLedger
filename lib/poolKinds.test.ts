import { describe, expect, it } from "vitest";
import {
  MANUAL_KINDS,
  NEGATIVE_MANUAL_KINDS,
  PLAYER_LINKED_KINDS,
  isManualKind,
  isNegativeManual,
  isPlayerLinked,
  ledgerRowTitle,
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
