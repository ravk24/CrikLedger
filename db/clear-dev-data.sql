-- ============================================================
-- CricLedger — RESET: clear all dev/seed data.
--
-- ⚠ Do NOT run during development (Ravi, 2026-08-18): dev-DB test
-- data accumulates through the whole build and is the verification
-- baseline. This file is reserved for the ONE deliberate pre-launch
-- reset after the application is fully built.
-- Keeps the superadmin (ravi_kant), the schema (tables, views,
-- RLS, grants), AND the migration-26 team seed (teams,
-- team_grounds, team_seasons, team_slots) — deleting the team
-- would CASCADE-wipe it and the app expects 'our-xi' to exist.
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
DELETE FROM admins WHERE role <> 'superadmin';

COMMIT;

-- Verify: both should return 0 / only the superadmin
-- SELECT count(*) FROM pool_entries;
-- SELECT username, role FROM admins;
