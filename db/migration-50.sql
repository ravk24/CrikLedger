-- ============================================================
-- Migration 50: one viewer session at a time
--
-- The team viewer (migration 49) is a shared credential, and the owner
-- wants exactly ONE player signed in with it at any moment. Sessions
-- are stateless JWTs, so "is someone signed in" needs one piece of
-- state: when the current viewer session began. NULL = free.
--
--   * login claims it atomically:
--       UPDATE admins SET viewer_session_started_at = NOW()
--        WHERE id = $1 AND viewer_session_started_at IS NULL
--     zero rows = someone else holds it -> 409 VIEWER_BUSY, naming the
--     team's superadmin as the person who can force it free.
--   * the viewer's own logout, and the superadmin's sign-out, reset and
--     remove, clear it (and bump session_epoch, so the old token dies).
--
-- Only meaningful on a viewer account; NULL on every other row. No
-- data changes.
-- ============================================================

BEGIN;

ALTER TABLE admins
  ADD COLUMN viewer_session_started_at TIMESTAMPTZ;

COMMIT;
