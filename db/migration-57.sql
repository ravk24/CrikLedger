-- ============================================================
-- Migration 57: a match can be a tie
--
-- The close-out wizard's first step offered Won / Lost only. From this
-- migration a completed match may also record 'tie' (Ravi 2026-10-17):
--
--   * match_result (team matches, migration 1) gains the enum value.
--   * tournament_matches.result is TEXT + CHECK (migration 22, declared
--     inline, so Postgres auto-named it tournament_matches_result_check —
--     confirm with
--       SELECT conname FROM pg_constraint
--        WHERE conrelid = 'tournament_matches'::regclass AND contype = 'c';
--     before running); the CHECK is swapped for one that admits 'tie'.
--
-- completed_has_result / t_completed_has_result are value-agnostic.
-- matches_public and tournament_matches_public only SELECT the column,
-- and an added enum value changes no view definition, so neither view
-- is touched (and security_invoker, migration 47, stays as it is).
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block
-- that also uses the value — run each statement separately (autocommit),
-- in order (same convention as migrations 4, 8, 54 and 55;
-- db/apply-migrations.mjs lists this file in AUTOCOMMIT_FILES). A
-- BEGIN…ROLLBACK dry-run covers the tournament statements only.
-- ============================================================

ALTER TYPE match_result ADD VALUE IF NOT EXISTS 'tie';

ALTER TABLE tournament_matches DROP CONSTRAINT tournament_matches_result_check;
ALTER TABLE tournament_matches ADD CONSTRAINT tournament_matches_result_check
  CHECK (result IN ('won','lost','tie'));

-- PostgREST caches the schema; the new value 404s until it reloads.
NOTIFY pgrst, 'reload schema';
