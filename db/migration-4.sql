-- ============================================================
-- LR-SuperGiants v1 — Migration 4: typed pool credits
--
-- Adds two manual credit kinds and the ground_bookings table.
-- Credit form now offers: player deposit | ground booking |
-- equipment purchase | other income.
--
-- A ground booking = an outside team books N ground slots:
-- one pool credit (the amount actually paid), one booking row
-- (team, captain, slots, paid, pending), and N scheduled
-- matches created in the same transaction — one per booked date.
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction
-- that also USES the new value. Run each statement separately
-- (autocommit), in order.
-- ============================================================

ALTER TYPE pool_entry_kind ADD VALUE IF NOT EXISTS 'ground_booking';
ALTER TYPE pool_entry_kind ADD VALUE IF NOT EXISTS 'equipment';

-- Re-point the sign CHECK at the widened credit list.
ALTER TABLE pool_entries DROP CONSTRAINT sign_matches_kind;
ALTER TABLE pool_entries ADD CONSTRAINT sign_matches_kind CHECK (
  (kind IN ('deposit','other_income','match_collection','expense_recovery',
            'ground_booking','equipment')
     AND amount > 0) OR
  (kind IN ('plain_debit','common_debit') AND amount < 0)
);

-- Booking details live beside the ledger, not inside it. The pool
-- entry holds only the paid amount; pending is settled later with a
-- follow-up manual credit. pool_entry_id is NULL when nothing was
-- paid up front (no credit row exists yet) or if the entry is later
-- deleted — the booking record itself is history and never deleted.
CREATE TABLE ground_bookings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_entry_id  UUID UNIQUE REFERENCES pool_entries(id) ON DELETE SET NULL,
  team_name      TEXT NOT NULL,
  captain        TEXT NOT NULL,
  slots          INT NOT NULL CHECK (slots > 0),
  amount_paid    NUMERIC(10,2) NOT NULL CHECK (amount_paid >= 0),
  amount_pending NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount_pending >= 0),
  created_by     UUID REFERENCES admins(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Same posture as every base table: RLS on, zero anon policies.
-- Captains' names and pending amounts are admin-only; the public
-- ledger row's message carries the public summary.
ALTER TABLE ground_bookings ENABLE ROW LEVEL SECURITY;
