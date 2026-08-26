// An outside team paying to use the ground: a ground_bookings row beside
// the ledger credit that records what they paid (app/api/pool/credit).
//
// Everything else that used to live here — per-slot shares, the revert
// on match delete, the booking-level pending clear — belonged to the
// home-match flow that made a booking CREATE matches. Migration 35
// dropped that flow, new bookings never carried a pending amount after
// it, and the 2026-08-22 reset left no booking-linked match, so
// migration 46 removed the columns and this file kept only the message.
// History: CrikLedger-docs/dropped-home_match-feature.md.

// Single source of truth for the BOOKING credit's ledger message.
export function buildBookingMessage(
  teamName: string,
  captain: string,
  slots: number,
): string {
  return (
    `Ground booking — ${teamName} (capt. ${captain}) · ` +
    `${slots} ${slots === 1 ? "slot" : "slots"} · fully paid`
  );
}
