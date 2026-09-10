-- ============================================================
-- Migration 53: drop the single-seat column
--
-- Migration 52 replaced admins.viewer_session_started_at (migration
-- 50) with viewer_sessions rows. The column stays until the code that
-- wrote it is gone: the pre-52 logout route set it to NULL on every
-- account, so dropping it ahead of the deploy broke logout. Apply this
-- only AFTER the deploy that carries lib/session.ts seat checks is
-- live — that code never reads or writes the column, so there is no
-- hurry. The column held no seat data worth keeping (the one viewer
-- account signs in again and takes a seat row). Runs as ONE transaction.
-- ============================================================

BEGIN;

ALTER TABLE admins DROP COLUMN viewer_session_started_at;

COMMIT;
