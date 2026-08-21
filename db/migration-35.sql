-- ============================================================
-- CricLedger — Migration 35: drop home matches, ground slots
--                            and the ground picker
--
-- The home-match flow rested on hardcoded seed data: 16 grounds
-- with per-car allowances and 61 pre-booked dates, both seeded
-- for slug='our-xi' only (migration-26). There is no admin UI for
-- either, so every new paid team would have needed hand-written
-- SQL to onboard. That operational cost is the reason for the
-- removal — not query load; 61 indexed rows per team is nothing.
--
-- Kept deliberately: ground_bookings, matches.ground_booking_id
-- and lib/bookings.ts. An outside team paying to use the ground is
-- still recordable as a pool credit; it just stops creating
-- matches. Legacy booking-linked matches keep working.
--
-- The full DDL, both seeds and the behavioural rules are preserved
-- in CrikLedger-docs/dropped-home_match-feature.md — read that
-- before reintroducing any of this.
--
-- ORDER MATTERS. CREATE OR REPLACE VIEW cannot remove a column, so
-- matches_public and teams_public are dropped and rebuilt, and both
-- drops must precede the ALTER TABLE ... DROP COLUMN statements
-- that they would otherwise block. Verified before writing: no
-- other view selects from either (grep over db/*.sql), so no
-- CASCADE is needed anywhere here.
--
-- Runs as ONE transaction. Destructive — see §2 below.
-- ============================================================

BEGIN;

-- ---------- 1. Drop the dependent views first ----------
DROP VIEW matches_public;
DROP VIEW teams_public;
DROP VIEW team_slots_public;
DROP VIEW team_grounds_public;

-- ---------- 2. Flatten and drop match provenance ----------
-- DESTRUCTIVE: which matches were played at home is not recoverable
-- after this. The distinction has no reader left — every match is
-- now scheduled through the single (formerly "away") flow.
-- DROP COLUMN takes matches_ground_check (migration-31) with it.
UPDATE matches SET ground = 'away';
ALTER TABLE matches DROP COLUMN ground;

-- ---------- 3. Drop the hardcoded config tables ----------
-- team_slots first: its composite FK (ts_season_same_team) points at
-- team_seasons. Nothing else references any of the three.
DROP TABLE team_slots;
DROP TABLE team_seasons;
DROP TABLE team_grounds;

-- ---------- 4. Drop the seeded home-ground columns ----------
-- home_ground_label already had no reader anywhere in the app;
-- home_ground_name was read only by lib/grounds.ts resolveGroundInfo,
-- deleted in the same commit. Both held 'Barne'-flavoured literals.
ALTER TABLE teams
  DROP COLUMN home_ground_name,
  DROP COLUMN home_ground_label;

-- ---------- 5. Rebuild the two survivors ----------
-- Bodies copied from migration-34:42-56 and migration-26:148-152,
-- minus the dropped columns. matches.venue stays: it is now the
-- free-text ground name typed on every match.
CREATE VIEW matches_public AS
SELECT m.id, m.match_date, m.opponent, m.status, m.result,
       m.abandoned_reason, m.ground_fee, m.ball_fee, m.other_fee,
       m.car_allowance_per_car, m.created_at, m.updated_at,
       a.name AS updated_by_name,
       m.guest_names,
       m.guest_cars,
       m.venue,
       m.fee_paid_to,
       m.team_id,
       m.ground_booking_id,
       m.guest_shared_cars
FROM matches m
LEFT JOIN admins a ON a.id = COALESCE(m.updated_by, m.created_by);

CREATE VIEW teams_public AS
SELECT id, slug, display_name, short_name,
       meeting_point, status_threshold, car_rate_per_km,
       brand_primary_color, brand_secondary_color, logo_ref, is_sandbox, created_at
FROM teams;

-- ---------- 6. Re-assert the migration-33 posture ----------
-- migration-33 set ALTER DEFAULT PRIVILEGES ... REVOKE SELECT ON
-- TABLES FROM anon, so a freshly created view starts locked. This is
-- belt-and-braces in case that default is ever loosened.
REVOKE SELECT ON matches_public, teams_public FROM anon;

COMMIT;

-- PostgREST caches the schema; dropped columns 404 until reload.
NOTIFY pgrst, 'reload schema';
