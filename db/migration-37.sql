-- ============================================================
-- CrikLedger — migration 37: entitlements (Feature 3/5 swap point)
--
-- What an account has PAID for, as rows. Until now lib/entitlements.ts
-- inferred "has Ledger" from a superadmin membership, and a team could
-- only be created by hand-run SQL (db/seed-team-superadmin.sql). The
-- operator console's grant flow (app/api/ops/grants) now writes:
--   1. the account (one-time password) if it does not exist,
--   2. a team shell + superadmin membership if the account owns none,
--   3. one row here per purchase.
--
-- Scope is the TEAM: admins of that team enjoy the product too, and
-- every tournament query in the app is team-scoped, so a tournament-
-- only purchaser still gets a team shell (they simply hold no
-- team_ledger row — Home shows the intro, Ledger stays greyed).
--
-- Tournament credits are CONSUMED: creating a tournament claims the
-- oldest unused credit (lib/tournaments.ts); deleting the tournament
-- frees it again via ON DELETE SET NULL.
--
-- price_inr is a snapshot at grant time — the operator's revenue number
-- is SUM(price_inr), so backfilled rows carry 0 and never inflate it.
-- ============================================================

BEGIN;

CREATE TABLE entitlements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product     TEXT NOT NULL CHECK (product IN ('team_ledger', 'tournament_credit')),
  team_id     UUID NOT NULL REFERENCES teams(id)  ON DELETE CASCADE,  -- the scope it unlocks
  admin_id    UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,  -- the purchaser
  price_inr   INTEGER NOT NULL CHECK (price_inr >= 0),               -- snapshot at grant time
  consumed_by_tournament_id UUID UNIQUE REFERENCES tournaments(id) ON DELETE SET NULL,
  consumed_at TIMESTAMPTZ,
  granted_by  UUID REFERENCES admins(id),                            -- the operator
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ent_consume_is_credit
    CHECK (consumed_by_tournament_id IS NULL OR product = 'tournament_credit'),
  CONSTRAINT ent_consume_stamp
    CHECK ((consumed_by_tournament_id IS NULL) = (consumed_at IS NULL))
);

-- One Ledger per team; a second grant to the same owner is refused
-- (the API maps 23505 to ALREADY_GRANTED). Credits repeat freely.
CREATE UNIQUE INDEX entitlements_one_ledger_per_team
  ON entitlements (team_id) WHERE product = 'team_ledger';
CREATE INDEX entitlements_team_idx ON entitlements (team_id, product);

-- House pattern (migrations 32/33): server reads use the service role;
-- anon never sees purchase records.
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON entitlements FROM anon;

-- ---------- Backfill ----------
-- Every team that already has a superadmin keeps working exactly as
-- before: it gets a Ledger row (price 0 — nothing was sold through the
-- console) and one consumed credit per tournament it has already run.
INSERT INTO entitlements (product, team_id, admin_id, price_inr, note)
SELECT 'team_ledger', tm.team_id, tm.admin_id, 0, 'backfill (pre-entitlements)'
  FROM team_memberships tm
  JOIN admins a ON a.id = tm.admin_id
 WHERE tm.team_role = 'superadmin' AND tm.is_active
   AND a.platform_role <> 'megaadmin'
ON CONFLICT DO NOTHING;

INSERT INTO entitlements
  (product, team_id, admin_id, price_inr, consumed_by_tournament_id, consumed_at, note)
SELECT 'tournament_credit', t.team_id, tm.admin_id, 0, t.id, t.created_at,
       'backfill (pre-entitlements)'
  FROM tournaments t
  JOIN team_memberships tm
    ON tm.team_id = t.team_id AND tm.team_role = 'superadmin' AND tm.is_active
 WHERE t.team_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Migration 32 left owner_admin_id NULL on the seeded team; the grant
-- flow keys "does this account already own a team" on it.
UPDATE teams t
   SET owner_admin_id = tm.admin_id
  FROM team_memberships tm
 WHERE tm.team_id = t.id AND tm.team_role = 'superadmin' AND tm.is_active
   AND t.owner_admin_id IS NULL;

COMMIT;
