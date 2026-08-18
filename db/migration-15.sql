-- ============================================================
-- LR-SuperGiants v2 — Migration 15: ledger rows carry the player name
--
-- Deposit and season-due rows should be titled by WHO they belong to
-- ("Deposit by {player}"), with the admin's free-text message shown
-- only in the row's expanded panel. The ledger view never exposed the
-- linked player, so the UI could not render that. Append player_name
-- (append-only -> OR REPLACE legal, anon grant survives; player names
-- are already anon-public via players_public).
-- ============================================================

CREATE OR REPLACE VIEW pool_ledger_public AS
SELECT pe.id, pe.entry_date, pe.kind, pe.message, pe.amount,
       a.name AS edited_by,
       pl.name AS player_name
FROM pool_entries pe
LEFT JOIN admins a ON a.id = COALESCE(pe.updated_by, pe.created_by)
LEFT JOIN players pl ON pl.id = pe.player_id
ORDER BY pe.entry_date DESC, pe.created_at DESC;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
