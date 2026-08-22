-- ============================================================
-- Migration 41: link a match's cleared-pending fee entry
--
-- clearMatchPending (lib/matches.ts) inserts a second pool entry for
-- the pending slice of a match fee and zeroes fee_pending, but kept no
-- link to that entry — so once pending was cleared, the total the
-- opponent paid (settled + cleared) could not be rebuilt from the match
-- row, and the Costs-step ground-fee prefill showed only the settled
-- slice (or 0 for an all-pending fee). Mirrors
-- ground_bookings.pending_cleared_entry_id (migration-14).
--
-- ON DELETE SET NULL: hand-deleting the entry from the ledger simply
-- unlinks it, like other_fee_entry_id (migration-18).
-- ============================================================

ALTER TABLE matches
  ADD COLUMN pending_cleared_entry_id UUID UNIQUE
    REFERENCES pool_entries(id) ON DELETE SET NULL;

-- Backfill entries cleared before the link existed: the message is the
-- only handle, so only link when exactly one unlinked cleared entry
-- matches the match's opponent within the team. Idempotent.
UPDATE matches m
SET pending_cleared_entry_id = c.id
FROM (
  SELECT pe.id, pe.team_id, pe.message
  FROM pool_entries pe
  WHERE pe.message LIKE 'Match fee (pending cleared) — vs %'
    AND NOT EXISTS (
      SELECT 1 FROM matches x WHERE x.pending_cleared_entry_id = pe.id
    )
) c
WHERE m.pending_cleared_entry_id IS NULL
  AND m.fee_direction IS NOT NULL
  AND m.team_id = c.team_id
  AND c.message LIKE 'Match fee (pending cleared) — vs ' || m.opponent || '%'
  AND (SELECT count(*) FROM matches y
       WHERE y.team_id = c.team_id AND y.opponent = m.opponent
         AND y.fee_direction IS NOT NULL AND y.pending_cleared_entry_id IS NULL) = 1;
