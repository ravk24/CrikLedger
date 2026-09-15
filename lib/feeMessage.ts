// Companion text for WhatsApp shares. WhatsApp drops share-sheet text
// that rides alongside files, so callers copy this to the clipboard
// first (inside the tap's user activation) and pass it to
// navigator.share only as best effort.
//
// The match sheet has two captions, chosen by whether the match had
// guests: with guests, the guest-fee message (captain's number + a
// tick-off list); without, a one-liner reminding players that the fee
// comes off their deposit (Ravi 2026-09-15).

export type ShareFeeMessage = {
  captainName: string;
  captainPhone: string;
  guests: string[];
};

// Match sheet: guest fees are charged to the standing captain's
// balance, so guests reimburse him directly.
export function buildGuestFeeMessage({
  captainName,
  captainPhone,
  guests,
}: ShareFeeMessage) {
  return [
    `Refer the match sheet above — please transfer the fee against your name to captain ${captainName}: ${captainPhone}.`,
    `Put a ✅ next to your name once you've paid:`,
    ...guests.map((name, i) => `${i + 1}. ${name}`),
  ].join("\n");
}

// Match sheet without guests: nobody owes the captain cash, every fee
// is debited from the player's pool deposit.
export function buildDepositFeeMessage() {
  return "Refer the match sheet above — mentioned fee will be deducted from your deposit.";
}

export type MatchSheetMessage =
  | ({ kind: "guests" } & ShareFeeMessage)
  | { kind: "deposit" };

export function buildMatchSheetMessage(message: MatchSheetMessage) {
  return message.kind === "guests"
    ? buildGuestFeeMessage(message)
    : buildDepositFeeMessage();
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
