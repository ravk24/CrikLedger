-- ============================================================
-- LR-SuperGiants v2 — Migration 18: Other-match fee recording
--
-- Barne slots were block-paid at season start; other venues are
-- pay-per-match. Scheduling an Other match now records the pool's
-- payment: fee_paid_to says who received it ('opponent' = we
-- transferred our share to the team that booked the ground;
-- 'owner' = we paid the ground owner directly and the opponent's
-- share flows offline to the captain), and other_fee_entry_id
-- links the plain_debit row holding SuperGiants' contribution.
--
-- Lifecycle: completion credits the pool contribution + roundoff
-- (match_collection = collected − cash costs + C); abandon /
-- cancel / delete return the fee by DELETING the debit row.
-- ON DELETE SET NULL: an admin hand-deleting the debit from the
-- ledger simply unlinks it — flows then skip the revert/recoup.
--
-- pool_entries.match_id cannot carry this link: it is UNIQUE and
-- reserved for the match_collection upsert.
--
-- Runs as one transaction (no enum changes).
-- ============================================================

ALTER TABLE matches
  ADD COLUMN fee_paid_to TEXT CHECK (fee_paid_to IN ('opponent', 'owner')),
  ADD COLUMN other_fee_entry_id UUID UNIQUE
    REFERENCES pool_entries(id) ON DELETE SET NULL;

-- fee_paid_to is public (shown on the match page); the entry id
-- stays private. Append-only -> OR REPLACE legal, grant survives.
CREATE OR REPLACE VIEW matches_public AS
SELECT m.id, m.match_date, m.opponent, m.status, m.result,
       m.abandoned_reason, m.ground_fee, m.ball_fee, m.other_fee,
       m.car_allowance_per_car, m.created_at, m.updated_at,
       a.name AS updated_by_name,
       m.guest_names,
       m.guest_cars,
       m.ground,
       m.venue,
       m.fee_paid_to
FROM matches m
LEFT JOIN admins a ON a.id = COALESCE(m.updated_by, m.created_by);

-- PostgREST caches the schema; new columns 404 until reload.
NOTIFY pgrst, 'reload schema';
