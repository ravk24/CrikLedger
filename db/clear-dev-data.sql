-- ============================================================
-- CrikLedger — RESET: clear ALL data, keep only the megaadmin.
--
-- ⚠ Destructive. Keeps the schema (tables, views, RLS, grants),
-- `_migrations`, and the single `admins` row with
-- platform_role = 'megaadmin' (ravi_kant). Everything else goes:
-- teams (incl. the old 'our-xi' seed — nothing in the app depends on
-- it any more; teams are created via /ops grants), tournaments,
-- players, matches, pool, entitlements, memberships, other accounts
-- (incl. ravi_kant_SA).
--
-- Since migration 32 the predicate is platform_role, NOT role:
-- 'superadmin' is now a membership, so the old
-- `role <> 'superadmin'` would delete every paying customer.
--
-- Run via `node db/reset.mjs --confirm` (takes a backup check first)
-- or paste into the SQL editor. Balances are derived views, so empty
-- tables = a clean zero state. No sequences/triggers exist.
-- Order matters: several FKs are NO ACTION (players,
-- tournament_players, every created_by/updated_by -> admins), so
-- children first, admins last.
-- ============================================================

BEGIN;

-- Tournament world
DELETE FROM tournament_fee_charge_lines;
DELETE FROM tournament_fee_charges;
DELETE FROM tournament_match_participants;
DELETE FROM tournament_expense_shares;
DELETE FROM tournament_entries;
DELETE FROM tournament_matches;
DELETE FROM tournament_players;
DELETE FROM tournament_memberships;
DELETE FROM entitlements;
DELETE FROM tournaments;

-- Team world
DELETE FROM expense_shares;
DELETE FROM match_participants;
DELETE FROM pool_entries;
DELETE FROM ground_bookings;
DELETE FROM matches;
DELETE FROM players;
DELETE FROM team_memberships;
DELETE FROM teams;

-- Accounts
DELETE FROM admins WHERE platform_role <> 'megaadmin';

-- Invalidate the megaadmin's outstanding session cookies
-- (pattern: db/seed-superadmin.sql).
UPDATE admins SET session_epoch = session_epoch + 1
WHERE platform_role = 'megaadmin';

COMMIT;

-- Verify:
-- SELECT username, platform_role FROM admins;   -- exactly ravi_kant / megaadmin
-- SELECT count(*) FROM teams;                   -- 0
