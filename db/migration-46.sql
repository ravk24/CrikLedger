-- Migration 46: retire the booking-linked-match machinery
--
-- Performance plan v2 item A7 (dead code). Migration 35 stopped a
-- ground booking from CREATING matches, but kept the columns that let
-- a pre-existing booking-linked match settle through its booking:
-- matches.ground_booking_id, ground_bookings.amount_pending and
-- ground_bookings.pending_cleared_entry_id, plus ground_bookings_public.
-- New bookings have written amount_pending = 0 ever since, and the
-- 2026-08-22 reset left no booking-linked match — verified on prod on
-- 2026-08-26: 0 rows in ground_bookings, 0 matches with a link, 0
-- pending amounts. The code that read these (lib/bookings.ts revert /
-- clear paths, the match page's booking block, the opponent-captain
-- field) is deleted in the same commit.
--
-- What stays: ground_bookings itself (an outside team paying to use
-- the ground is still recorded from the Pool page, with the amount
-- actually paid), and matches.fee_pending / pending_cleared_entry_id —
-- the match-level fee that replaced the booking split in migration 36.
--
-- matches_public loses a column, so it is DROP + CREATE (CREATE OR
-- REPLACE cannot remove one — see migration 35); its body is otherwise
-- migration 36's. Nothing depends on the view, and PostgREST re-reads
-- the schema on the NOTIFY.

BEGIN;

-- ---------- ground_bookings_public: no reader left ----------
DROP VIEW IF EXISTS ground_bookings_public;

-- ---------- matches_public without ground_booking_id ----------
DROP VIEW matches_public;
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
       m.guest_shared_cars,
       m.fee_direction,
       m.fee_pending
FROM matches m
LEFT JOIN admins a ON a.id = COALESCE(m.updated_by, m.created_by);
REVOKE SELECT ON matches_public FROM anon;

-- ---------- the link column and its index ----------
DROP INDEX IF EXISTS matches_ground_booking_id_idx;
ALTER TABLE matches DROP COLUMN ground_booking_id;

-- ---------- booking-level pending state ----------
ALTER TABLE ground_bookings DROP CONSTRAINT IF EXISTS gb_pending_entry_same_team;
ALTER TABLE ground_bookings DROP COLUMN pending_cleared_entry_id;
ALTER TABLE ground_bookings DROP COLUMN amount_pending;

COMMIT;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
