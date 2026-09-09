-- ============================================================
-- Migration 49: the team viewer role
--
-- A third team_role, 'viewer': one shared read-only login per team
-- that the superadmin creates alongside the <=2 admins. Any number of
-- players sign in with it at once (sessions are stateless JWTs), and
-- the superadmin ends every one of those sessions by bumping the
-- viewer account's session_epoch — the same lever reset-password uses.
--
-- What changes here is small on purpose:
--   * the team_role CHECK admits 'viewer';
--   * one active viewer per team, enforced by a partial unique.
--
-- What does NOT change: tm_admin_has_slot is an equality
-- ((team_role = 'admin') = (admin_slot IS NOT NULL)), so a viewer is
-- forced to admin_slot NULL and never competes for the two admin
-- slots. tournament_memberships is untouched — a team-hosted
-- tournament resolves rights through the team scope, so a team viewer
-- already reads it; a standalone tournament has no team and gets no
-- viewer.
--
-- Write refusal lives in code: lib/roles.ts canWrite() now consults
-- the role (it used to grant any membership), and lib/session.ts
-- answers 403 VIEWER_READ_ONLY. Constraint name verified on prod
-- 2026-09-09: team_memberships_team_role_check.
--
-- Runs as ONE transaction. Touches no data.
-- ============================================================

BEGIN;

ALTER TABLE team_memberships
  DROP CONSTRAINT team_memberships_team_role_check;
ALTER TABLE team_memberships
  ADD CONSTRAINT team_memberships_team_role_check
  CHECK (team_role IN ('superadmin', 'admin', 'viewer'));

-- One shared login per team. Removing the viewer flips is_active, so
-- a later create is allowed again (and mints a fresh account).
CREATE UNIQUE INDEX team_memberships_one_viewer_key
  ON team_memberships (team_id)
  WHERE team_role = 'viewer' AND is_active;

COMMIT;
