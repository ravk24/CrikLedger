-- ============================================================
-- Migration 42: expose created_at on the ledger views
--
-- entry_date is a DATE; without a timestamp tiebreak, same-day rows
-- sort by the random UUID id, which reads as an unordered ledger.
-- The (scope, entry_date DESC, created_at DESC) indexes from
-- migration 40 were always the intent — the views just stopped
-- exposing created_at when their in-view ORDER BY was dropped.
--
-- created_at is appended as the last column, which CREATE OR REPLACE
-- allows, so grants survive.
-- ============================================================

CREATE OR REPLACE VIEW pool_ledger_public AS
SELECT pe.id, pe.entry_date, pe.kind, pe.message, pe.amount,
       a.name AS edited_by,
       pl.name AS player_name,
       pe.team_id,
       pe.created_at
FROM pool_entries pe
LEFT JOIN admins a ON a.id = COALESCE(pe.updated_by, pe.created_by)
LEFT JOIN players pl ON pl.id = pe.player_id;

CREATE OR REPLACE VIEW tournament_ledger_public AS
SELECT te.id, te.tournament_id, te.entry_date, te.kind, te.message, te.amount,
       a.name  AS edited_by,
       tp.name AS player_name,
       t.team_id,
       te.created_at
FROM tournament_entries te
LEFT JOIN admins a ON a.id = COALESCE(te.updated_by, te.created_by)
LEFT JOIN tournament_players tp ON tp.id = te.player_id
JOIN tournaments t ON t.id = te.tournament_id;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
