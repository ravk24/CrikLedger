-- ============================================================
-- LR-SuperGiants v2 — Migration 17: away-match venue
--
-- The Other Slots flow schedules free-form away matches; venue is
-- the away ground's name (free text, admin-entered). NULL for all
-- Barne matches — the Barne ground needs no naming.
--
-- matches_public also gains ground and venue: the match detail
-- page reads matches_public (not the base table), and ground was
-- never added to the view when migration-13 introduced it — the
-- Match type already claimed it, so this closes that gap too.
-- Both appends are column-additive -> OR REPLACE legal, anon
-- grant survives.
--
-- Runs as one transaction (no enum changes).
-- ============================================================

ALTER TABLE matches ADD COLUMN venue TEXT;

CREATE OR REPLACE VIEW matches_public AS
SELECT m.id, m.match_date, m.opponent, m.status, m.result,
       m.abandoned_reason, m.ground_fee, m.ball_fee, m.other_fee,
       m.car_allowance_per_car, m.created_at, m.updated_at,
       a.name AS updated_by_name,
       m.guest_names,
       m.guest_cars,
       m.ground,
       m.venue
FROM matches m
LEFT JOIN admins a ON a.id = COALESCE(m.updated_by, m.created_by);

-- PostgREST caches the schema; new columns 404 until reload.
NOTIFY pgrst, 'reload schema';
