import { describe, expect, it } from "vitest";
import {
  buildDepositFeeMessage,
  buildDuesMessage,
  buildGuestFeeMessage,
  buildMatchSheetMessage,
} from "./feeMessage";

const GUEST_TEXT = [
  "Refer the match sheet above — please transfer the fee against your name to captain Ravi: 9800000000.",
  "Put a ✅ next to your name once you've paid:",
  "1. Amit",
  "2. Bala",
].join("\n");

const DEPOSIT_TEXT =
  "Refer the match sheet above — mentioned fee will be deducted from your deposit.";

describe("buildGuestFeeMessage", () => {
  it("names the captain, the phone, and numbers the guests", () => {
    expect(
      buildGuestFeeMessage({
        captainName: "Ravi",
        captainPhone: "9800000000",
        guests: ["Amit", "Bala"],
      }),
    ).toBe(GUEST_TEXT);
  });
});

describe("buildDepositFeeMessage", () => {
  it("is the single deposit reminder line", () => {
    expect(buildDepositFeeMessage()).toBe(DEPOSIT_TEXT);
  });
});

describe("buildMatchSheetMessage", () => {
  it("dispatches guests → guest fee message", () => {
    expect(
      buildMatchSheetMessage({
        kind: "guests",
        captainName: "Ravi",
        captainPhone: "9800000000",
        guests: ["Amit", "Bala"],
      }),
    ).toBe(GUEST_TEXT);
  });

  it("dispatches deposit → deposit reminder", () => {
    expect(buildMatchSheetMessage({ kind: "deposit" })).toBe(DEPOSIT_TEXT);
  });
});

describe("buildDuesMessage", () => {
  it("names the captain and numbers the owing players", () => {
    expect(
      buildDuesMessage({
        captainName: "Ravi",
        captainPhone: "9800000000",
        players: ["Chetan", "Dev"],
      }),
    ).toBe(
      [
        "Refer the balances above — please transfer your pending amount to captain Ravi: 9800000000.",
        "Put a ✅ next to your name once you've paid:",
        "1. Chetan",
        "2. Dev",
      ].join("\n"),
    );
  });
});
