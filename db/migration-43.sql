-- ============================================================
-- Migration 43: captain contact phone
--
-- A deliberate, narrow reversal of migration 5 ("remove phone
-- numbers"): the fee-collection share message on a completed match
-- tells guests where to transfer their fee, and that needs the
-- standing captain's number. One nullable column on players (the
-- captain IS a player — migration 27 enforces one is_captain per
-- team), written only by the superadmin captain flow
-- (app/api/players/[id]/captain).
--
-- Exposure stays minimal: the column is NOT added to players_public
-- or any other view. Server code reads it with the pg pool inside
-- admin-gated paths only, so no publicly-rendered payload carries
-- it. The number is kept when captaincy transfers — it belongs to
-- the person and prefills if they return.
--
-- Stored normalized: optional leading +, 8–15 digits (the API
-- strips spaces/dashes before writing).
-- ============================================================

ALTER TABLE players ADD COLUMN phone TEXT
  CONSTRAINT players_phone_format CHECK (phone ~ '^\+?[0-9]{8,15}$');

COMMENT ON COLUMN players.phone IS
  'Captain contact number for the fee-collection share message. Superadmin-entered; deliberately absent from players_public (see migration 5).';
