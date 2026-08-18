-- ============================================================
-- LR-SuperGiants v2 — Migration 14: booking ↔ cleared-pending link
--
-- Clearing a booking's pending fee inserts a standalone BOOKING
-- credit ("Pending amount cleared — …"). Deleting a booking match
-- later must revert that credit's slot share alongside the paid
-- share, which needs a real link from the booking to the credit.
--
-- ON DELETE SET NULL: an admin hand-deleting the credit (it is a
-- manual-editable kind) simply unlinks it; the revert flow then
-- skips it.
--
-- Runs as one transaction (no enum changes).
-- ============================================================

ALTER TABLE ground_bookings
  ADD COLUMN pending_cleared_entry_id UUID UNIQUE
    REFERENCES pool_entries(id) ON DELETE SET NULL;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
