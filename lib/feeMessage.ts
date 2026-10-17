// Companion text for WhatsApp shares. WhatsApp drops share-sheet text
// that rides alongside files, so callers copy this to the clipboard
// first (inside the tap's user activation) and pass it to
// navigator.share only as best effort.
//
// The match sheet caption is an opener chosen by the result (won /
// lost / tie — Ravi 2026-10-17), a blank line, then a body chosen by
// whether the match had guests: with guests, the guest-fee message
// (captain's number + a tick-off list); without, a one-liner saying the
// fee has come off every player's deposit (Ravi 2026-09-15).

import type { MatchResult } from "@/types";

export type ShareFeeMessage = {
  result: MatchResult;
  captainName: string;
  captainPhone: string;
  guests: string[];
};

const OPENERS: Record<MatchResult, string> = {
  won: "Congratulations team 🎉 on winning the match!",
  lost: "Hard luck team — we'll come back stronger next time 💪",
  tie: "Well played team — a tie! 🤝",
};

export function resultOpener(result: MatchResult) {
  return OPENERS[result];
}

// Match sheet: guest fees are charged to the standing captain's
// balance, so guests reimburse him directly.
export function buildGuestFeeMessage({
  result,
  captainName,
  captainPhone,
  guests,
}: ShareFeeMessage) {
  return [
    resultOpener(result),
    "",
    `Please refer to the match sheet above — the players listed below need to transfer their fee to captain ${captainName}: ${captainPhone}.`,
    `Put a ✅ next to your name once you've paid:`,
    ...guests.map((name, i) => `${i + 1}. ${name}`),
  ].join("\n");
}

// Match sheet without guests: nobody owes the captain cash, every fee
// has been debited from the player's pool deposit on submit.
export function buildDepositFeeMessage(result: MatchResult) {
  return [
    resultOpener(result),
    "",
    "Please refer to the match sheet above — the fee mentioned against each name has been deducted from every player's deposit.",
  ].join("\n");
}

export type MatchSheetMessage =
  | ({ kind: "guests" } & ShareFeeMessage)
  | { kind: "deposit"; result: MatchResult };

export function buildMatchSheetMessage(message: MatchSheetMessage) {
  return message.kind === "guests"
    ? buildGuestFeeMessage(message)
    : buildDepositFeeMessage(message.result);
}

export type DuesMessage = {
  captainName: string;
  captainPhone: string;
  // Owing players, biggest debtor first.
  players: string[];
};

// Tournament balances: players in debt to the fund settle via the
// tournament captain.
export function buildDuesMessage({
  captainName,
  captainPhone,
  players,
}: DuesMessage) {
  return [
    `Refer the balances above — please transfer your pending amount to captain ${captainName}: ${captainPhone}.`,
    `Put a ✅ next to your name once you've paid:`,
    ...players.map((name, i) => `${i + 1}. ${name}`),
  ].join("\n");
}
