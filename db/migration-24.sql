-- ============================================================
-- LR-SuperGiants v2 — Migration 24: statement drill-down views
--
-- Read-only ingredients for the tournament player statement's
-- expandable "Tournament fee" row. Mirrors the settlement filter
-- in lib/tournaments.ts exactly: a slot is any participant row
-- whose match is status='completed' (there is no is_playing flag;
-- the TRUE in tournament_match_participants_public is a literal).
-- perSlot is not persisted; clients recover it as
-- (amount + driver_credit) / played — exact, all inputs integer.
-- ============================================================

-- Per-match slots + car credit, per player. Rows exist before
-- settlement too; the UI only consults this when a
-- tournament_fee_charges row exists.
CREATE VIEW tournament_fee_breakdown_public AS
SELECT tmp.player_id,
       tmp.tournament_id,
       tmp.match_id,
       tm.match_date,
       tm.match_time,
       tm.opponent,
       tmp.brought_car,
       CASE WHEN tmp.brought_car THEN tm.car_allowance_per_car
            ELSE 0 END AS car_credit
FROM tournament_match_participants tmp
JOIN tournament_matches tm ON tm.id = tmp.match_id
WHERE tm.status = 'completed';

-- Persisted settlement numbers (authoritative even if matches are
-- later edited); created_at = when the tournament was settled.
CREATE VIEW tournament_fee_charges_public AS
SELECT tfc.tournament_id, tfc.player_id, tfc.played,
       tfc.driver_credit, tfc.amount, tfc.created_at
FROM tournament_fee_charges tfc;

GRANT SELECT ON tournament_fee_breakdown_public,
               tournament_fee_charges_public TO anon;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
