-- ============================================================
-- Migration 44: tournament captain contact phone
--
-- Tournament analogue of migration 43: the balances-share settlement
-- message tells owing players where to transfer their dues, and that
-- needs the tournament captain's number. One nullable column on
-- tournament_players (an independent typed-name roster, migration 19;
-- one is_captain per tournament, migration 20), written only by the
-- admin captain flow (app/api/tournaments/[id]/players/[pid]/captain).
--
-- Exposure stays minimal: NOT added to tournament_players_public or
-- any other view. Server code reads it with the pg pool inside
-- admin-gated paths only. The number is kept when captaincy
-- transfers — it belongs to the person and prefills if they return.
--
-- Stored normalized: optional leading +, 8–15 digits (the API
-- strips spaces/dashes before writing).
-- ============================================================

ALTER TABLE tournament_players ADD COLUMN phone TEXT
  CONSTRAINT tournament_players_phone_format CHECK (phone ~ '^\+?[0-9]{8,15}$');

COMMENT ON COLUMN tournament_players.phone IS
  'Tournament captain contact number for the dues-settlement share message. Admin-entered; deliberately absent from tournament_players_public (see migration 44 header).';
