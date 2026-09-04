-- ============================================================
-- Migration 48: expose a ledger entry's owning match
--
-- A plain_debit / other_income row can be a match's fee
-- (matches.other_fee_entry_id, migration 18) or its cleared-pending
-- slice (matches.pending_cleared_entry_id, migration 41). Both links
-- are ON DELETE SET NULL, and those headers say hand-deleting the
-- entry "simply unlinks it". That is no longer the behaviour:
-- DELETE /api/pool/entries/[id] now deletes a SCHEDULED match along
-- with both of its fee entries, and refuses (409 AUTO_ENTRY) when the
-- match is COMPLETED, because the fee is baked into its stored
-- collection. The ledger UI needs the link to warn before it asks.
--
-- Three columns appended (CREATE OR REPLACE allows appending only):
-- match_id, match_opponent (raw, NULL = "Opponent TBD"), match_status.
-- Both link columns are UNIQUE, so the OR-join yields at most one
-- match per entry; the team_id predicate mirrors the composite FK.
--
-- WITH (security_invoker = true) is REQUIRED: CREATE OR REPLACE VIEW
-- replaces the view's options with the ones given here, so omitting
-- it would silently undo migration 47 for this view.
-- ============================================================

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
      AND (m.other_fee_entry_id = pe.id OR m.pending_cleared_entry_id = pe.id);

-- PostgREST caches the schema; the new columns 404 until it reloads.
NOTIFY pgrst, 'reload schema';
