-- ============================================================
-- LR-SuperGiants v2 — Migration 12: match ↔ ground-booking link
--
-- Deleting a booking-linked match must return that match's slot
-- share to the ledger (reduce the BOOKING credit, decrement the
-- booking). That needs a real link: the credit route now stamps
-- each booking match with its booking id, and this migration adds
-- the column plus a one-time backfill for legacy rows using the
-- same heuristic the app already used at runtime — the LATEST
-- booking whose team_name equals the match's opponent.
--
-- Optional: preview the backfill first with
--   SELECT m.id, m.opponent, m.status, gb.id AS booking_id
--   FROM matches m
--   JOIN (SELECT DISTINCT ON (team_name) id, team_name
--         FROM ground_bookings
--         ORDER BY team_name, created_at DESC) gb
--     ON m.opponent = gb.team_name
--   WHERE m.ground_booking_id IS NULL;
--
-- Runs as one transaction (no enum changes).
-- ============================================================

ALTER TABLE matches
  ADD COLUMN ground_booking_id UUID REFERENCES ground_bookings(id) ON DELETE SET NULL;

CREATE INDEX matches_ground_booking_id_idx ON matches (ground_booking_id);

UPDATE matches m
SET ground_booking_id = gb.id
FROM (
  SELECT DISTINCT ON (team_name) id, team_name
  FROM ground_bookings
  ORDER BY team_name, created_at DESC
) gb
WHERE m.ground_booking_id IS NULL
  AND m.opponent = gb.team_name;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
