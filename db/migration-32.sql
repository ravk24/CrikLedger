-- ============================================================
-- CricLedger — Migration 32: accounts + per-scope memberships
--
-- Feature 4 (auth) foundation, per the 2026-08-18 prepare session.
-- `admins` STAYS the identity table — ~12 FKs and every created_by
-- stamp point at it, so a rename would churn the whole schema for
-- nothing. It becomes an ACCOUNT: username + email + password, with
-- no team and no powers of its own.
--
-- Authorization moves entirely into membership rows. Two scopes,
-- deliberately parallel:
--   team_memberships       — 1 Ledger purchase = 1 owned team
--   tournament_memberships — 1 Tournament purchase = 1 owned tournament
-- Each scope carries its own allowance of <= 2 admins, enforced by a
-- partial unique on an explicit slot column (the players_one_captain
-- precedent; this repo has no triggers).
--
-- admins.role (ENUM admin_role) is REPURPOSED into platform_role
-- TEXT+CHECK ('user','megaadmin') rather than kept: with per-scope
-- roles in membership rows, an account-level 'admin'/'superadmin'
-- column would still be readable by ~45 call sites while meaning
-- nothing. One source of authorization, or none.
--
-- megaadmin (ravi_kant) is platform-level ONLY: he reads everything
-- to reproduce user-reported bugs and writes nothing on customer
-- data (enforced in lib/roles.ts + the write guards). He must never
-- hold a membership row — team rights live on a separate account.
--
-- Verified on the dev DB before writing:
--   - admin_role is used by exactly one column (admins.role)
--   - NO view depends on admins.role (the 6 views that join admins
--     select a.name / a.id only) => the type conversion is safe
--   - no TypeScript reads admins.team_id => it can be dropped
--   - tournaments holds 0 rows and its children FK on tournament_id
--     alone (not composite with team_id) => DROP NOT NULL is safe
--
-- Deletes NO rows. No ALTER TYPE ... ADD VALUE anywhere, so this
-- file must NOT be added to AUTOCOMMIT_FILES — running it as one
-- transaction is what makes it all-or-nothing.
-- ============================================================

BEGIN;

-- ---------- 1. admins.role -> platform_role (TEXT + CHECK) ----------
-- House style is TEXT+CHECK over enums (tenancy-schema.md). The old
-- values do not survive: 'superadmin' was "admin of the only team",
-- which is now a membership, not an account property.
ALTER TABLE admins ALTER COLUMN role DROP DEFAULT;
ALTER TABLE admins ALTER COLUMN role TYPE TEXT USING role::TEXT;
ALTER TABLE admins RENAME COLUMN role TO platform_role;

UPDATE admins SET platform_role = 'user';
UPDATE admins SET platform_role = 'megaadmin' WHERE username = 'ravi_kant';

ALTER TABLE admins ALTER COLUMN platform_role SET DEFAULT 'user';
ALTER TABLE admins ADD CONSTRAINT admins_platform_role_check
  CHECK (platform_role IN ('user', 'megaadmin'));

DROP TYPE admin_role;

-- ---------- 2. Account columns ----------
-- email: the recovery channel and Razorpay receipt target. Nullable
-- because the seeded megaadmin has none; signup requires it at the
-- API layer. Uniqueness is case-insensitive and skips NULLs.
ALTER TABLE admins ADD COLUMN email TEXT;
ALTER TABLE admins ADD CONSTRAINT admins_email_shape
  CHECK (email IS NULL OR email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
CREATE UNIQUE INDEX admins_email_lower_key
  ON admins (lower(email)) WHERE email IS NOT NULL;

-- session_epoch: the JWT carries it; loadSessionAdmin() compares and
-- rejects on mismatch. Logout and password change bump it, which is
-- how outstanding tokens die without a sessions table.
ALTER TABLE admins ADD COLUMN session_epoch INTEGER NOT NULL DEFAULT 1;

-- ---------- 3. Team memberships ----------
CREATE TABLE team_memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES teams(id)  ON DELETE CASCADE,
  admin_id   UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  team_role  TEXT NOT NULL CHECK (team_role IN ('superadmin', 'admin')),
  admin_slot SMALLINT,      -- 1 or 2 for admins; NULL for the superadmin
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,   -- per-TEAM revoke; the account lives on
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (team_id, admin_id),   -- one row per (team, account)
  UNIQUE (team_id, id),         -- composite-FK target (house pattern)
  CONSTRAINT tm_admin_has_slot
    CHECK ((team_role = 'admin') = (admin_slot IS NOT NULL)),
  CONSTRAINT tm_slot_range
    CHECK (admin_slot IS NULL OR admin_slot IN (1, 2)),
  CONSTRAINT tm_revoked_stamp
    CHECK (is_active OR revoked_at IS NOT NULL)
);

-- The <=2 allowance. Revoking frees the slot; a third active admin
-- raises 23505, which the API maps to TEAM_ADMIN_LIMIT. The API also
-- pre-checks inside the same transaction so the normal path returns
-- the friendly code — this index is the race backstop.
CREATE UNIQUE INDEX team_memberships_admin_slot_key
  ON team_memberships (team_id, admin_slot)
  WHERE team_role = 'admin' AND is_active;

-- Per-request membership load is keyed by account.
CREATE INDEX team_memberships_admin_idx
  ON team_memberships (admin_id) WHERE is_active;

-- ---------- 4. Tournament memberships ----------
-- A tournament purchase stands alone: the buyer may own no team at
-- all, so this mirrors team_memberships rather than deriving from it.
CREATE TABLE tournament_memberships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  admin_id      UUID NOT NULL REFERENCES admins(id)      ON DELETE CASCADE,
  tournament_role TEXT NOT NULL CHECK (tournament_role IN ('superadmin', 'admin')),
  admin_slot    SMALLINT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES admins(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ,
  UNIQUE (tournament_id, admin_id),
  UNIQUE (tournament_id, id),
  CONSTRAINT tnm_admin_has_slot
    CHECK ((tournament_role = 'admin') = (admin_slot IS NOT NULL)),
  CONSTRAINT tnm_slot_range
    CHECK (admin_slot IS NULL OR admin_slot IN (1, 2)),
  CONSTRAINT tnm_revoked_stamp
    CHECK (is_active OR revoked_at IS NOT NULL)
);

CREATE UNIQUE INDEX tournament_memberships_admin_slot_key
  ON tournament_memberships (tournament_id, admin_slot)
  WHERE tournament_role = 'admin' AND is_active;

CREATE INDEX tournament_memberships_admin_idx
  ON tournament_memberships (admin_id) WHERE is_active;

-- Memberships are server-side reads only: who administers a team is
-- not public. No *_public view, no anon grant.
ALTER TABLE team_memberships       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON team_memberships, tournament_memberships FROM anon;

-- ---------- 5. Ownership (who bought the scope) ----------
-- A pointer, not a partial unique on memberships: ownership is the
-- purchase record, while superadmin membership is the access grant.
-- Feature 5 sets these when a verified payment provisions the scope.
ALTER TABLE teams       ADD COLUMN owner_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL;
ALTER TABLE tournaments ADD COLUMN owner_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL;

-- A tournament-only purchaser owns no team, so a tournament can
-- stand alone. Safe today: tournaments holds 0 rows, and its child
-- tables FK on tournament_id alone. Note tournaments_team_name_key
-- UNIQUE (team_id, name) stops constraining once team_id is NULL
-- (NULLs are distinct) — standalone tournaments may share a name,
-- which is correct across different owners.
ALTER TABLE tournaments ALTER COLUMN team_id DROP NOT NULL;

-- ---------- 6. Backfill from the interim hook ----------
-- migration-27's admins.team_id becomes real membership rows. Slots
-- are assigned in creation order; a team already holding >2 admins
-- would violate tm_slot_range and abort the migration loudly, which
-- is correct — there is nothing safe to silently drop.
-- Current dev data: zero such rows.
INSERT INTO team_memberships
  (team_id, admin_id, team_role, admin_slot, is_active, created_by, created_at, revoked_at)
SELECT a.team_id, a.id, 'admin',
       (ROW_NUMBER() OVER (PARTITION BY a.team_id
                           ORDER BY a.is_active DESC, a.created_at, a.id))::SMALLINT,
       a.is_active, a.created_by, a.created_at,
       CASE WHEN a.is_active THEN NULL ELSE NOW() END
FROM admins a
WHERE a.team_id IS NOT NULL AND a.platform_role <> 'megaadmin';

-- ---------- 7. Retire the interim hook ----------
-- Two sources of truth for membership is the bug this feature exists
-- to remove. Verified by grep: no TS/TSX reads admins.team_id.
ALTER TABLE admins DROP COLUMN team_id;

-- NOTE: 'our-xi' is deliberately left with owner_admin_id NULL here.
-- The megaadmin may not own it, and the account that will
-- (ravi_kant_SA) is created by db/seed-team-superadmin.sql, which
-- carries a password and therefore never lives in a migration.

COMMIT;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
