import type { PoolClient } from "pg";
import { formatDateShort, formatRupees, opponentLabel } from "@/lib/format";
import { ApiError } from "@/lib/validate";

// A booking's money is split evenly across its slots. The share is
// recomputed from the booking's CURRENT remaining values on every
// delete, and the last slot takes the exact remainder — the deltas
// telescope to the original totals, so rounding can never drift.
export function computeSlotShare(amount: number, slots: number): number {
  return slots === 1 ? amount : Math.round(amount / slots);
}

// Single source of truth for the BOOKING credit's ledger message —
// used on create and rebuilt on every slot-share revert.
export function buildBookingMessage(
  teamName: string,
  captain: string,
  slots: number,
  amountPending: number,
): string {
  return (
    `Ground booking — ${teamName} (capt. ${captain}) · ` +
    `${slots} ${slots === 1 ? "slot" : "slots"}` +
    (amountPending > 0
      ? ` · ₹${formatRupees(amountPending)} pending`
      : " · fully paid")
  );
}

// Deleting a booking-linked match returns that match's slot share to
// the ledger: the booking loses one slot and its share of the money,
// and the BOOKING credit shrinks to match (the captain settles the
// opponent's cash offline). If the booking's pending fee was cleared
// (a standalone "Pending amount cleared" credit), that credit gives
// back its slot share too. The last slot removes the booking and both
// credits outright — the CHECKs forbid zero-slot / zero-amount rows.
// Caller must hold the match row FOR UPDATE inside the same transaction.
export async function revertBookingShare(
  client: PoolClient,
  adminId: string,
  groundBookingId: string | null,
): Promise<{ paidShare: number; clearedShare: number; slotsLeft: number } | null> {
  if (!groundBookingId) return null;

  const bookingRes = await client.query(
    `SELECT id, pool_entry_id, pending_cleared_entry_id, team_name,
            captain, slots, amount_paid, amount_pending
     FROM ground_bookings
     WHERE id = $1
     FOR UPDATE`,
    [groundBookingId],
  );
  const booking = bookingRes.rows[0];
  if (!booking) return null;

  const slots = Number(booking.slots);
  const paid = Number(booking.amount_paid);
  const pending = Number(booking.amount_pending);
  const paidShare = computeSlotShare(paid, slots);
  const pendingShare = computeSlotShare(pending, slots);

  // Cleared-pending credit: lock it and take this slot's share (all of
  // it on the last slot). NULL FK = never cleared, or credit was
  // hand-deleted from the ledger — nothing to revert.
  let clearedShare = 0;
  if (booking.pending_cleared_entry_id) {
    const clearedRes = await client.query(
      `SELECT amount FROM pool_entries WHERE id = $1 FOR UPDATE`,
      [booking.pending_cleared_entry_id],
    );
    const clearedAmount = Number(clearedRes.rows[0]?.amount ?? 0);
    clearedShare =
      slots === 1 ? clearedAmount : computeSlotShare(clearedAmount, slots);
    const newCleared = clearedAmount - clearedShare;
    if (slots === 1 || newCleared <= 0) {
      // FK ON DELETE SET NULL unlinks the booking automatically.
      await client.query(`DELETE FROM pool_entries WHERE id = $1`, [
        booking.pending_cleared_entry_id,
      ]);
    } else {
      await client.query(
        `UPDATE pool_entries
         SET amount = $2, updated_by = $3, updated_at = NOW()
         WHERE id = $1`,
        [booking.pending_cleared_entry_id, newCleared, adminId],
      );
    }
  }

  if (slots === 1) {
    await client.query(`DELETE FROM ground_bookings WHERE id = $1`, [
      booking.id,
    ]);
    // Report what actually left the ledger — the credit may have been
    // hand-edited away from the booking's recorded amount_paid.
    let deleted = 0;
    if (booking.pool_entry_id) {
      const delRes = await client.query(
        `DELETE FROM pool_entries WHERE id = $1 RETURNING amount`,
        [booking.pool_entry_id],
      );
      deleted = Number(delRes.rows[0]?.amount ?? 0);
    }
    return { paidShare: deleted, clearedShare, slotsLeft: 0 };
  }

  await client.query(
    `UPDATE ground_bookings
     SET slots = $2, amount_paid = $3, amount_pending = $4
     WHERE id = $1`,
    [booking.id, slots - 1, paid - paidShare, pending - pendingShare],
  );

  if (booking.pool_entry_id) {
    const entryRes = await client.query(
      `SELECT amount FROM pool_entries WHERE id = $1 FOR UPDATE`,
      [booking.pool_entry_id],
    );
    const newAmount = Number(entryRes.rows[0].amount) - paidShare;
    if (newAmount > 0) {
      await client.query(
        `UPDATE pool_entries
         SET amount = $2, message = $3, updated_by = $4, updated_at = NOW()
         WHERE id = $1`,
        [
          booking.pool_entry_id,
          newAmount,
          buildBookingMessage(
            booking.team_name,
            booking.captain,
            slots - 1,
            pending - pendingShare,
          ),
          adminId,
        ],
      );
    } else {
      // Credit was manually edited below its booking's share — the sign
      // CHECK forbids ≤ 0, so remove it (FK NULLs pool_entry_id). Report
      // the credit's actual remaining amount as the deduction.
      const delRes = await client.query(
        `DELETE FROM pool_entries WHERE id = $1 RETURNING amount`,
        [booking.pool_entry_id],
      );
      return {
        paidShare: Number(delRes.rows[0]?.amount ?? 0),
        clearedShare,
        slotsLeft: slots - 1,
      };
    }
  }

  return { paidShare, clearedShare, slotsLeft: slots - 1 };
}

// One-way clear of a booking's pending fee — the captain confirms the
// opponent's remaining cash arrived. amount_pending drops to 0, the
// BOOKING credit's message flips to "fully paid" (its amount stays
// equal to amount_paid — the invariant), and a NEW ground_booking
// credit records the received money. Booking-level: every sibling
// match of a multi-slot booking flips to Paid together.
export async function clearBookingPending(
  client: PoolClient,
  adminId: string,
  matchId: string,
  expectedPending: number,
): Promise<{ cleared: number }> {
  const matchRes = await client.query(
    `SELECT id, opponent, match_date::text AS match_date, ground_booking_id
     FROM matches WHERE id = $1 FOR UPDATE`,
    [matchId],
  );
  const match = matchRes.rows[0];
  if (!match) {
    throw new ApiError(404, "NOT_FOUND", "Match not found");
  }
  if (!match.ground_booking_id) {
    throw new ApiError(
      409,
      "NO_BOOKING",
      "This match has no linked ground booking",
    );
  }

  const bookingRes = await client.query(
    `SELECT id, pool_entry_id, team_name, captain, slots, amount_pending, team_id
     FROM ground_bookings WHERE id = $1 FOR UPDATE`,
    [match.ground_booking_id],
  );
  const booking = bookingRes.rows[0]; // FK guarantees presence
  const pending = Number(booking.amount_pending);
  if (pending <= 0) {
    throw new ApiError(
      409,
      "ALREADY_CLEARED",
      "The match fee is already fully paid",
    );
  }
  if (pending !== expectedPending) {
    throw new ApiError(
      409,
      "PENDING_MISMATCH",
      "The pending amount changed — refresh and try again",
    );
  }

  // match_id stays NULL — that column is UNIQUE and reserved for the
  // match_collection upsert, and the booking may span several matches.
  const entryRes = await client.query(
    `INSERT INTO pool_entries (kind, message, amount, created_by, team_id)
     VALUES ('ground_booking', $1, $2, $3, $4)
     RETURNING id`,
    [
      `Pending amount cleared — ${booking.team_name} (capt. ${booking.captain})` +
        ` · match vs ${opponentLabel(match.opponent)} on ${formatDateShort(match.match_date)}`,
      pending,
      adminId,
      booking.team_id,
    ],
  );

  // The link lets a later match delete revert this credit's slot share.
  await client.query(
    `UPDATE ground_bookings
     SET amount_pending = 0, pending_cleared_entry_id = $2
     WHERE id = $1`,
    [booking.id, entryRes.rows[0].id],
  );

  if (booking.pool_entry_id) {
    await client.query(
      `UPDATE pool_entries
       SET message = $2, updated_by = $3, updated_at = NOW()
       WHERE id = $1`,
      [
        booking.pool_entry_id,
        buildBookingMessage(
          booking.team_name,
          booking.captain,
          Number(booking.slots),
          0,
        ),
        adminId,
      ],
    );
  }

  return { cleared: pending };
}
