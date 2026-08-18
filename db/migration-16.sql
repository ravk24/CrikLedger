-- ============================================================
-- LR-SuperGiants v2 — Migration 16: restore the ₹900 LOW threshold
--
-- The threshold raise (200 → 900) originally shipped as
-- migration-13 and was applied to prod, but commit a835968 later
-- OVERWROTE db/migration-13.sql with the ground-provenance
-- migration — so a from-scratch replay of the repo's migrations
-- silently recreates players_public with the old ₹200 rule.
-- This re-adds the lost definition (recovered via
-- `git show 8f7c750:db/migration-13.sql`). Running it on prod is
-- a harmless no-op; on a fresh setup it is required.
--
-- Same as migration-10's players_public, only the status CASE
-- differs: a balance under ₹900 reads as LOW, exactly ₹900 counts
-- as surplus.
-- ============================================================

CREATE OR REPLACE VIEW players_public AS
SELECT
  p.id,
  p.name,
  p.is_active,
  b.balance,
  CASE
    WHEN NOT p.is_active   THEN 'inactive'
    WHEN b.balance >= 900  THEN 'surplus'   -- green
    WHEN b.balance >= 0    THEN 'low'       -- orange
    ELSE                        'debt'      -- red
  END AS status,
  p.is_captain,
  p.is_vice_captain
FROM players p JOIN player_balances b ON b.id = p.id;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
