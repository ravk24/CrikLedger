-- ============================================================
-- cricledger — Migration 31: barne→home / other→away rename
--
-- Feature 2 config-surface step (tenancy-schema.md decision 4).
-- matches.ground stops carrying the SuperGiants ground name and
-- becomes generic provenance: 'home' (pre-booked home-ground slot
-- flow) / 'away' (free-form away scheduling). Display labels come
-- from team config (teams.home_ground_label); the code enum, zod
-- schema, and raw SQL switch to 'home'/'away' in the same commit.
--
-- Views pass the values through unchanged — no view DDL needed.
-- Verified before writing: the CHECK is the migration-13 inline
-- default name matches_ground_check; column default is 'barne'.
--
-- Runs as one transaction.
-- ============================================================

BEGIN;

ALTER TABLE matches DROP CONSTRAINT matches_ground_check;

UPDATE matches
SET ground = CASE ground WHEN 'barne' THEN 'home' ELSE 'away' END;

ALTER TABLE matches ALTER COLUMN ground SET DEFAULT 'home';

ALTER TABLE matches
  ADD CONSTRAINT matches_ground_check CHECK (ground IN ('home', 'away'));

COMMIT;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
