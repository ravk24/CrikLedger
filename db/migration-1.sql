-- ============================================================
-- LR-SuperGiants v0 — Revised Database Schema (Supabase / Postgres)
-- Supersedes the PRD schema. Key changes:
--   * NO stored balances anywhere — all balances derived from ledger rows
--   * Custom table-based auth (NO Supabase Auth, NO phone numbers for login)
--     - superadmin row seeded manually; superadmin creates admins
--     - temp password + forced change on first sign-in
--   * Matches carry status (scheduled / completed / abandoned)
--   * Guest rows = repeated host player_id with guest_name for display
--   * Unified pool ledger incl. auto match-collection entries
--   * Public access ONLY via masked views; base tables locked down
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for crypt()/gen_salt() password hashing

-- ---------- 1. PLAYERS ----------
CREATE TABLE players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  phone_number  TEXT UNIQUE NOT NULL,          -- REMOVED by migration-5 (PII); name is UNIQUE since then
  is_active     BOOLEAN NOT NULL DEFAULT TRUE, -- inactive = left team, greyed out
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- NOTE: no current_balance column. Balance is always derived (see views).

-- ---------- 2. ADMINS (custom auth; superadmin is just a role) ----------
CREATE TYPE admin_role AS ENUM ('admin', 'superadmin');

CREATE TABLE admins (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username              TEXT UNIQUE NOT NULL,      -- login id chosen by superadmin
  name                  TEXT NOT NULL,             -- shown on "edited by" stamps
  password_hash         TEXT NOT NULL,             -- bcrypt via crypt(); NEVER plaintext
  role                  admin_role NOT NULL DEFAULT 'admin',
  must_change_password  BOOLEAN NOT NULL DEFAULT TRUE,  -- forced change on first sign-in
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,  -- FALSE = revoked; checked per request
  created_by            UUID REFERENCES admins(id),     -- which superadmin created this admin
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the superadmin ONCE, manually, in the Supabase SQL editor:
--   INSERT INTO admins (username, name, password_hash, role, must_change_password)
--   VALUES ('ravi_kant', 'Ravi', crypt('YourStrongPassword', gen_salt('bf')),
--           'superadmin', FALSE);
-- Login verification (in the auth server route):
--   SELECT id, role, must_change_password FROM admins
--   WHERE username = $1 AND is_active
--     AND password_hash = crypt($2, password_hash);

-- ---------- 3. MATCHES ----------
CREATE TYPE match_status AS ENUM ('scheduled', 'completed', 'abandoned');
CREATE TYPE match_result AS ENUM ('won', 'lost');

CREATE TABLE matches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_date            DATE NOT NULL,
  opponent              TEXT NOT NULL,
  status                match_status NOT NULL DEFAULT 'scheduled',
  result                match_result,                  -- NULL unless completed
  abandoned_reason      TEXT,                          -- NULL unless abandoned
  -- financial inputs (0 until completed; totals are DERIVED, not stored)
  ground_fee            NUMERIC(10,2) NOT NULL DEFAULT 0,
  ball_fee              NUMERIC(10,2) NOT NULL DEFAULT 0,
  other_fee             NUMERIC(10,2) NOT NULL DEFAULT 0,  -- umpire/water/misc
  car_allowance_per_car NUMERIC(10,2) NOT NULL DEFAULT 0,  -- entered per match
  -- audit
  created_by            UUID REFERENCES admins(id),
  updated_by            UUID REFERENCES admins(id),    -- "last updated by"
  updated_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT completed_has_result
    CHECK (status <> 'completed' OR result IS NOT NULL),
  CONSTRAINT abandoned_has_reason
    CHECK (status <> 'abandoned' OR abandoned_reason IS NOT NULL)
);

-- ---------- 4. MATCH PARTICIPANTS ----------
-- One row per attendee. Guests: repeat the HOST's player_id with guest_name
-- filled in, so 12 attendance = 12 rows, but only registered accounts charged.
-- NOTE: guest_name REMOVED by migration-6 — guests became display-only
-- names on matches.guest_names; captain settles guest money offline.
CREATE TABLE match_participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id    UUID NOT NULL REFERENCES players(id),   -- account charged (host, for guests)
  guest_name   TEXT,                                   -- NULL = the player themself
  brought_car  BOOLEAN NOT NULL DEFAULT FALSE,         -- only ever TRUE on self rows
  fee_amount   NUMERIC(10,2) NOT NULL,                 -- FINAL amount after admin edits;
                                                       -- positive = debit, negative = driver credit
  CONSTRAINT one_self_row_per_match
    UNIQUE NULLS NOT DISTINCT (match_id, player_id, guest_name),
  CONSTRAINT guests_dont_drive
    CHECK (guest_name IS NULL OR brought_car = FALSE)
);
-- Player's match debits = SUM(fee_amount) over their rows (guest rows included).

-- ---------- 5. POOL LEDGER (unified team fund) ----------
-- Signed amounts: positive = credit (green), negative = debit (red).
CREATE TYPE pool_entry_kind AS ENUM (
  'deposit',           -- player top-up  (manual; credits pool AND player)
  'other_income',      -- misc income    (manual; pool only)
  'match_collection',  -- AUTO on match submit; v1: = rounding surplus only (collected - cash costs); row absent when surplus <= 0
  'expense_recovery',  -- LEGACY (v0): auto credit on common debit; no longer written since v1
  'plain_debit',       -- ground booking paid, advance, misc (manual; pool only)
  'common_debit'       -- team gear; spawns expense_shares (manual)
);

CREATE TABLE pool_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  kind        pool_entry_kind NOT NULL,
  message     TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,       -- signed; CHECK below enforces sign
  player_id   UUID REFERENCES players(id),  -- required iff kind = 'deposit'
  match_id    UUID UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
                                            -- required iff kind = 'match_collection';
                                            -- UNIQUE = one auto-credit per match, edits update it
  created_by  UUID REFERENCES admins(id),
  updated_by  UUID REFERENCES admins(id),   -- "edited-by" column in ledger UI
  updated_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sign_matches_kind CHECK (
    (kind IN ('deposit','other_income','match_collection','expense_recovery')
       AND amount > 0) OR
    (kind IN ('plain_debit','common_debit') AND amount < 0)
  ),
  CONSTRAINT deposit_has_player
    CHECK (kind <> 'deposit' OR player_id IS NOT NULL),
  CONSTRAINT collection_has_match
    CHECK (kind <> 'match_collection' OR match_id IS NOT NULL)
);

-- ---------- 6. EXPENSE SHARES (common-debit split) ----------
-- Created automatically when a common_debit is submitted:
-- share = CEILING(expense / active player count) per active player.
-- pool_entry_id points at the common_debit row; the paired expense_recovery
-- credit references it via recovery_of (below) for traceability.
CREATE TABLE expense_shares (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_entry_id  UUID NOT NULL REFERENCES pool_entries(id) ON DELETE CASCADE,
  player_id      UUID NOT NULL REFERENCES players(id),
  amount         NUMERIC(10,2) NOT NULL CHECK (amount > 0),  -- debit vs player
  UNIQUE (pool_entry_id, player_id)
);

ALTER TABLE pool_entries
  ADD COLUMN recovery_of UUID UNIQUE REFERENCES pool_entries(id) ON DELETE CASCADE;
  -- set only on kind='expense_recovery' rows -> their common_debit row

-- ============================================================
-- DERIVED BALANCES — the single source of truth
-- ============================================================

-- Per-player balance = deposits − match fees − common-expense shares
CREATE VIEW player_balances AS
SELECT
  p.id,
  COALESCE(d.total, 0) - COALESCE(m.total, 0) - COALESCE(e.total, 0) AS balance
FROM players p
LEFT JOIN (SELECT player_id, SUM(amount)     AS total FROM pool_entries
           WHERE kind = 'deposit' GROUP BY player_id) d ON d.player_id = p.id
LEFT JOIN (SELECT player_id, SUM(fee_amount) AS total FROM match_participants
           GROUP BY player_id) m ON m.player_id = p.id
LEFT JOIN (SELECT player_id, SUM(amount)     AS total FROM expense_shares
           GROUP BY player_id) e ON e.player_id = p.id;

-- Pool balance = simple signed sum of the ledger
CREATE VIEW pool_balance AS
SELECT COALESCE(SUM(amount), 0) AS balance FROM pool_entries;

-- ============================================================
-- PUBLIC (anon-safe) VIEWS
-- (phone_masked removed by migration-5 — view recreated there)
-- ============================================================
CREATE VIEW players_public AS
SELECT
  p.id,
  p.name,
  '••••' || RIGHT(p.phone_number, 4) AS phone_masked,
  p.is_active,
  b.balance,
  CASE
    WHEN NOT p.is_active   THEN 'inactive'
    WHEN b.balance > 200   THEN 'surplus'   -- green
    WHEN b.balance >= 0    THEN 'low'       -- orange
    ELSE                        'debt'      -- red
  END AS status
FROM players p JOIN player_balances b ON b.id = p.id;

CREATE VIEW pool_ledger_public AS
SELECT pe.id, pe.entry_date, pe.kind, pe.message, pe.amount,
       a.name AS edited_by
FROM pool_entries pe
LEFT JOIN admins a ON a.id = COALESCE(pe.updated_by, pe.created_by)
ORDER BY pe.entry_date DESC, pe.created_at DESC;

-- Match detail rows for the public match page (hosts repeated per guest)
CREATE VIEW match_participants_public AS
SELECT mp.match_id,
       pl.name AS player_name,
       mp.guest_name,
       mp.brought_car,
       mp.fee_amount
FROM match_participants mp JOIN players pl ON pl.id = mp.player_id;

-- ============================================================
-- ROW LEVEL SECURITY — lock everything, expose only views
-- ============================================================
ALTER TABLE players            ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins             ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_shares     ENABLE ROW LEVEL SECURITY;
-- No anon policies on base tables => anon sees nothing from them.
-- With custom auth there is NO Supabase 'authenticated' role in play:
-- ALL admin reads and writes go through Next.js server routes using the
-- service-role key (bypasses RLS), gated by the signed session cookie.

-- Anon may read matches metadata (no phone data lives there) + public views:
CREATE POLICY anon_read_matches ON matches FOR SELECT TO anon USING (true);
GRANT SELECT ON players_public, pool_ledger_public,
               match_participants_public, pool_balance TO anon;
REVOKE ALL ON players, admins, pool_entries,
              match_participants, expense_shares FROM anon;

-- ============================================================
-- SERVER-ROUTE OPERATIONS (each = ONE Postgres transaction)
-- ============================================================
--  AUTH
--  login(username, password)
--    -> verify vs crypt(); reject if NOT is_active
--    -> issue signed httpOnly cookie {admin_id, role}
--    -> if must_change_password: respond with force_change flag
--  change_password(new_password)
--    -> UPDATE admins SET password_hash = crypt(new, gen_salt('bf')),
--       must_change_password = FALSE  WHERE id = session.admin_id
--  Every authed request re-checks is_active (revocation = instant lockout).
--
--  SUPERADMIN ONLY (role check on session)
--  create_admin(username, name, temp_password)
--    -> INSERT admins (hash temp, must_change_password = TRUE)
--  revoke_admin(admin_id)  -> is_active = FALSE (history/"edited by" persists)
--  reset_admin_password(admin_id, temp_password) -> new hash + force change
--
--  MONEY (any active admin)
--  submit_match(match_id, result, fees..., participants[], drivers[], guests[])
--    1. UPDATE matches (status='completed', result, fee inputs, updated_by)
--    2. DELETE + INSERT match_participants (final admin-edited fee_amounts)
--    3. UPSERT pool_entries match_collection row: amount = surplus only
--       (SUM(fee_amount) - cash costs); DELETE the row when surplus <= 0  [v1]
--  edit_match(...)   -> same as submit; derived balances make reversal free
--  abandon_match(match_id, reason)  -> status change only, no financials
--  schedule_match(date, opponent)   -> INSERT matches (status='scheduled')
--  add_common_debit(amount, message)
--    1. INSERT pool_entries (common_debit, -amount)
--    2. INSERT expense_shares: CEIL(amount / active_count) per active player
--       (v1: shares hit player balances only — no expense_recovery credit)
--  add_deposit(player_id, amount, message) -> one pool_entries row
--  settle_player(player_id) -> ordinary ledger entries + is_active = FALSE
-- ============================================================
