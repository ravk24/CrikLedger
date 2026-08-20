-- Migration 34: who shared the car
--
-- The car allowance used to be funded by every head. It is now funded by
-- the people who actually rode with someone, so attendance needs a second
-- car flag alongside brought_car:
--
--   brought_car -> provided a car, receives the allowance
--   shared_car  -> rode with someone, helps pay for the cars
--
-- A driver is never a sharer (they provided the car), which the engine
-- enforces rather than a CHECK constraint: ticking both in an older
-- client must degrade to "brought", not fail the write.
--
-- Guests live as index-aligned arrays on matches (guest_names /
-- guest_cars), so their sharing flag is a third array in the same shape.
--
-- Tournaments are deliberately untouched: tournament_match_participants
-- keeps brought_car only, and engine/tournamentFee.ts keeps splitting car
-- money across everyone in the match.

ALTER TABLE match_participants
  ADD COLUMN IF NOT EXISTS shared_car BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS guest_shared_cars BOOLEAN[] NOT NULL DEFAULT '{}';

-- Both views gain the new column LAST. Appending keeps CREATE OR REPLACE
-- legal and preserves the existing grants; reordering would force a DROP
-- VIEW plus re-GRANT (see migration-6).
CREATE OR REPLACE VIEW match_participants_public AS
SELECT mp.match_id,
       pl.name AS player_name,
       mp.brought_car,
       mp.fee_amount,
       pl.is_captain,
       mp.is_playing,
       mp.guest_fee_share,
       mp.team_id,
       mp.shared_car
FROM match_participants mp JOIN players pl ON pl.id = mp.player_id;

CREATE OR REPLACE VIEW matches_public AS
SELECT m.id, m.match_date, m.opponent, m.status, m.result,
       m.abandoned_reason, m.ground_fee, m.ball_fee, m.other_fee,
       m.car_allowance_per_car, m.created_at, m.updated_at,
       a.name AS updated_by_name,
       m.guest_names,
       m.guest_cars,
       m.ground,
       m.venue,
       m.fee_paid_to,
       m.team_id,
       m.ground_booking_id,
       m.guest_shared_cars
FROM matches m
LEFT JOIN admins a ON a.id = COALESCE(m.updated_by, m.created_by);

NOTIFY pgrst, 'reload schema';
