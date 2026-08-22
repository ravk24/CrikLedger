-- Migration 39: who shared the car (tournaments)
--
-- Tournaments adopt the team rule from migration-34: car money is funded
-- by the people who rode with someone, not by every head in the match.
--
--   brought_car -> provided a car, receives the allowance
--   shared_car  -> rode with someone, helps pay for the cars
--
-- A driver is never a sharer; the engine (engine/tournamentFee.ts)
-- enforces it rather than a CHECK so an older client ticking both
-- degrades to "brought". When nobody in a match shared, no car money is
-- collected and no rebate is paid.

ALTER TABLE tournament_match_participants
  ADD COLUMN IF NOT EXISTS shared_car BOOLEAN NOT NULL DEFAULT FALSE;

-- Column appended LAST so CREATE OR REPLACE stays legal and the existing
-- grants survive (see migration-6 / migration-34).
CREATE OR REPLACE VIEW tournament_match_participants_public AS
SELECT tmp.match_id, tmp.tournament_id, tp.name AS player_name,
       tmp.brought_car, tmp.fee_amount, tp.is_captain,
       TRUE AS is_playing, 0::numeric AS guest_fee_share,
       t.team_id,
       tmp.shared_car
FROM tournament_match_participants tmp
JOIN tournament_players tp ON tp.id = tmp.player_id
JOIN tournaments t ON t.id = tmp.tournament_id;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
