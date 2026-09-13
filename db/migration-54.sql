-- ============================================================
-- Migration 54: abandoned matches refund the fee with a ledger row
--
-- Until now POST /api/matches/[id]/abandon returned an away match's
-- fronted fee by DELETING the debit row (migration 18's rule), which
-- left no trace in the ledger. From this migration the debit stays
-- and a locked AUTO · CANCELLED row reverses it:
--
--   * pool_entry_kind gains 'match_refund'. Its amount is minus the
--     sum of the match's fee rows (settled + cleared-pending), so it
--     is positive for the usual pool-fronted debit and negative for a
--     credit-direction fee — sign_matches_kind allows either, but not
--     zero (a zero-fee match writes no row at all).
--   * matches.refund_entry_id links the row, same shape as
--     other_fee_entry_id (migration 18 / 28): UNIQUE, composite
--     same-team FK, ON DELETE SET NULL.
--   * pool_ledger_public joins the third link so the row carries
--     match_id / match_opponent / match_status like the fee rows.
--
-- pool_balance is an unfiltered signed sum (migration 29) — nothing
-- to change there.
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction
-- that also USES the new value — run each statement separately
-- (autocommit), in order (same convention as migrations 4 and 8;
-- db/apply-migrations.mjs lists this file in AUTOCOMMIT_FILES).
-- A BEGIN…ROLLBACK dry-run therefore stops at the sign_matches_kind
-- re-add with "unsafe use of new value" — expected, not a defect.
-- ============================================================

ALTER TYPE pool_entry_kind ADD VALUE IF NOT EXISTS 'match_refund';

ALTER TABLE pool_entries DROP CONSTRAINT sign_matches_kind;
ALTER TABLE pool_entries ADD CONSTRAINT sign_matches_kind CHECK (
  (kind IN ('deposit','other_income','match_collection','expense_recovery',
            'ground_booking','equipment') AND amount > 0) OR
  (kind IN ('plain_debit','common_debit','opening_due') AND amount < 0) OR
  (kind = 'match_refund' AND amount <> 0)
);

ALTER TABLE matches ADD COLUMN refund_entry_id UUID UNIQUE;
ALTER TABLE matches ADD CONSTRAINT m_refund_entry_same_team
  FOREIGN KEY (team_id, refund_entry_id) REFERENCES pool_entries (team_id, id)
  ON DELETE SET NULL (refund_entry_id);

-- Same view as migration 48 plus the refund link. All three link
-- columns are UNIQUE, so the OR-join still yields at most one match
-- per entry. WITH (security_invoker = true) is REQUIRED (migration 47/48).
CREATE OR REPLACE VIEW pool_ledger_public
  WITH (security_invoker = true) AS
SELECT pe.id, pe.entry_date, pe.kind, pe.message, pe.amount,
       a.name AS edited_by,
       pl.name AS player_name,
       pe.team_id,
       pe.created_at,
       m.id       AS match_id,
       m.opponent AS match_opponent,
       m.status   AS match_status
FROM pool_entries pe
LEFT JOIN admins a ON a.id = COALESCE(pe.updated_by, pe.created_by)
LEFT JOIN players pl ON pl.id = pe.player_id
LEFT JOIN matches m
       ON m.team_id = pe.team_id
      AND (m.other_fee_entry_id = pe.id
           OR m.pending_cleared_entry_id = pe.id
           OR m.refund_entry_id = pe.id);

-- PostgREST caches the schema; the new column 404s until it reloads.
NOTIFY pgrst, 'reload schema';
