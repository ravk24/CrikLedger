-- ============================================================
-- LR-SuperGiants v2 — Migration 21: tournament team name + venue
--
-- Tournament Details grows "Your Team Name" (what our side is called
-- in that tournament) and "Ground/Venue" (fed by the same hardcoded
-- grounds dropdown as SG scheduling; free text for Other grounds).
-- The season_label field is retired from the UI — the column stays
-- (CREATE OR REPLACE views cannot drop columns, and old data keeps
-- its history) but nothing writes or displays it anymore.
-- ============================================================

ALTER TABLE tournaments ADD COLUMN team_name TEXT;
ALTER TABLE tournaments ADD COLUMN venue TEXT;

-- Append-only -> OR REPLACE legal, anon grant survives.
CREATE OR REPLACE VIEW tournaments_public AS
SELECT t.id, t.name, t.season_label, t.start_date, t.end_date, t.status,
       COALESCE(f.balance, 0) AS fund_balance,
       COALESCE(pc.count, 0)  AS player_count,
       t.created_at,
       t.team_name, t.venue
FROM tournaments t
LEFT JOIN (SELECT tournament_id, SUM(amount) AS balance
           FROM tournament_entries
           GROUP BY tournament_id) f ON f.tournament_id = t.id
LEFT JOIN (SELECT tournament_id, COUNT(*) FILTER (WHERE is_active) AS count
           FROM tournament_players
           GROUP BY tournament_id) pc ON pc.tournament_id = t.id;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
