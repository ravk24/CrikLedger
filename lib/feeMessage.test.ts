import { describe, expect, it } from "vitest";
import {
  buildDepositFeeMessage,
  buildDuesMessage,
  buildGuestFeeMessage,
  buildMatchSheetMessage,
  resultOpener,
} from "./feeMessage";

const WON = "Congratulations team 🎉 on winning the match!";
const LOST = "Hard luck team — we'll come back stronger next time 💪";
const TIE = "Well played team — a tie! 🤝";

const GUEST_BODY = [
  "Please refer to the match sheet above — the players listed below need to transfer their fee to captain Ravi: 9800000000.",
  "Put a ✅ next to your name once you've paid:",
  "1. Amit",
  "2. Bala",
].join("\n");

const DEPOSIT_BODY =
  "Please refer to the match sheet above — the fee mentioned against each name has been deducted from every player's deposit.";

const GUESTS = {
  captainName: "Ravi",
  captainPhone: "9800000000",
  guests: ["Amit", "Bala"],
};

describe("resultOpener", () => {
  it("has one line per result", () => {
    expect(resultOpener("won")).toBe(WON);
    expect(resultOpener("lost")).toBe(LOST);
    expect(resultOpener("tie")).toBe(TIE);
  });
});

describe("buildGuestFeeMessage", () => {
  it("opens with the result, then names the captain, the phone, and numbers the guests", () => {
    expect(buildGuestFeeMessage({ result: "won", ...GUESTS })).toBe(
      `${WON}\n\n${GUEST_BODY}`,
    );
  });

  it("carries the lost and tie openers too", () => {
    expect(buildGuestFeeMessage({ result: "lost", ...GUESTS })).toBe(
      `${LOST}\n\n${GUEST_BODY}`,
    );
    expect(buildGuestFeeMessage({ result: "tie", ...GUESTS })).toBe(
      `${TIE}\n\n${GUEST_BODY}`,
    );
  });
});

describe("buildDepositFeeMessage", () => {
  it("opens with the result, then the single deposit line", () => {
    expect(buildDepositFeeMessage("won")).toBe(`${WON}\n\n${DEPOSIT_BODY}`);
    expect(buildDepositFeeMessage("lost")).toBe(`${LOST}\n\n${DEPOSIT_BODY}`);
    expect(buildDepositFeeMessage("tie")).toBe(`${TIE}\n\n${DEPOSIT_BODY}`);
  });
});

describe("buildMatchSheetMessage", () => {
  it("dispatches guests → guest fee message", () => {
    expect(
      buildMatchSheetMessage({ kind: "guests", result: "won", ...GUESTS }),
    ).toBe(`${WON}\n\n${GUEST_BODY}`);
  });

  it("dispatches deposit → deposit reminder", () => {
    expect(buildMatchSheetMessage({ kind: "deposit", result: "lost" })).toBe(
      `${LOST}\n\n${DEPOSIT_BODY}`,
    );
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
