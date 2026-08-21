-- ============================================================
-- CrikLedger — RESET: clear all dev/seed data.
--
-- ⚠ Do NOT run during development (Ravi, 2026-08-18): dev-DB test
-- data accumulates through the whole build and is the verification
-- baseline. This file is reserved for the ONE deliberate pre-launch
-- reset after the application is fully built.
-- Keeps the megaadmin (ravi_kant), the schema (tables, views,
-- RLS, grants), AND the migration-26 team seed (teams) — deleting
-- the team would CASCADE-wipe it and the app expects 'our-xi' to
-- exist. team_grounds/team_seasons/team_slots were dropped in
-- migration 35 (see dropped-home_match-feature.md).
--
-- Since migration 32 the predicate is platform_role, NOT role:
-- 'superadmin' is now a membership, so the old
-- `role <> 'superadmin'` would delete every paying customer.
-- Run once in the SQL editor (or via pg) right before entering
-- real players. Balances are derived, so empty tables = a clean
-- zero state. Order matters: children first, then parents.
-- ============================================================

BEGIN;

DELETE FROM expense_shares;
DELETE FROM ground_bookings;
DELETE FROM pool_entries;
DELETE FROM match_participants;
DELETE FROM matches;
DELETE FROM players;
-- Memberships CASCADE from admins, but team-scoped rows belonging
-- to the surviving megaadmin would not — and the megaadmin must
-- never hold one anyway. Clear them explicitly.
DELETE FROM tournament_memberships;
DELETE FROM team_memberships;
DELETE FROM admins WHERE platform_role <> 'megaadmin';

COMMIT;

-- Verify: both should return 0 / only the megaadmin
-- SELECT count(*) FROM pool_entries;
-- SELECT username, platform_role FROM admins;
