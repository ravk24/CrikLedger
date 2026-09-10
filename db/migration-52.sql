-- ============================================================
-- Migration 52: ten viewer seats
--
-- Migration 50 gave the team viewer (migration 49) ONE seat as a
-- nullable timestamp on admins. The owner now wants up to ten players
-- signed in on the shared credential at once, each individually
-- sign-out-able by the superadmin. That needs one row per seat.
--
--   * login (viewer accounts only): FOR UPDATE the admins row, delete
--     seats older than the JWT lifetime (their token has expired, so
--     the seat is dead), count, refuse with 409 VIEWER_BUSY at the
--     limit (lib/viewerSeats.ts VIEWER_SEAT_LIMIT), else INSERT and
--     carry the row id in the token as `sid`;
--   * every request from a token carrying `sid` requires the row to
--     still exist (lib/session.ts) — deleting a row signs out exactly
--     that phone without touching session_epoch; a viewer token
--     without `sid` is refused outright;
--   * the viewer's own logout deletes its row; the superadmin deletes
--     one (per-seat sign-out) or all (sign-out-all, reset, remove —
--     those three still bump the epoch as well).
--
-- Additive only: the table. The old seat column on admins is dropped
-- by migration 53, applied only AFTER the deploy that stops writing it
-- is live (the previous logout route wrote it on every account). Server-side
-- only, like team_memberships: no *_public view. Posture as migration
-- 47/51. Runs as ONE transaction.
-- ============================================================

BEGIN;

CREATE TABLE viewer_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Coarse label from the User-Agent ("iPhone", "Android phone"); the
  -- raw string is never stored.
  device     TEXT CHECK (device IS NULL OR length(device) BETWEEN 1 AND 40)
);

CREATE INDEX viewer_sessions_admin_idx ON viewer_sessions (admin_id);

ALTER TABLE viewer_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON viewer_sessions FROM anon, authenticated;

COMMIT;
