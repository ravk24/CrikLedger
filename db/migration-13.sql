-- ============================================================
-- LR-SuperGiants v2 — Migration 13: match ground provenance
--
-- The /matches list tags each match with where it was scheduled
-- from: 'barne' (Barne Slots flows — manual scheduling and
-- ground-booking credits) or 'other' (the future Other Slots
-- scheduling flow, which must INSERT ground = 'other' explicitly).
-- The DEFAULT backfills every existing match as 'barne' — all
-- current matches were created from the Barne section.
--
-- Runs as one transaction (no enum changes).
-- ============================================================

ALTER TABLE matches
  ADD COLUMN ground TEXT NOT NULL DEFAULT 'barne'
  CHECK (ground IN ('barne', 'other'));

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
