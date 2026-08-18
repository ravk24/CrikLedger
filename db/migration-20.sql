-- ============================================================
-- LR-SuperGiants v2 — Migration 20: tournament captain & vice-captain
--
-- Mirrors the SG pattern (migrations 7 + 10) scoped PER TOURNAMENT:
-- at most one captain and one vice-captain per tournament (partial
-- unique on tournament_id — indexing the boolean itself would allow
-- only one captain across ALL tournaments), never the same player.
-- Declared by any admin from the tournament Admin console; flags are
-- display + guard only (no money semantics — no matches yet).
-- ============================================================

ALTER TABLE tournament_players ADD COLUMN is_captain BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tournament_players ADD COLUMN is_vice_captain BOOLEAN NOT NULL DEFAULT FALSE;

-- At most one of each per tournament, enforced by the database.
CREATE UNIQUE INDEX tournament_players_one_captain
  ON tournament_players (tournament_id) WHERE is_captain;
CREATE UNIQUE INDEX tournament_players_one_vice_captain
  ON tournament_players (tournament_id) WHERE is_vice_captain;

-- Captain and vice-captain are always different people.
ALTER TABLE tournament_players ADD CONSTRAINT t_captain_is_not_vice
  CHECK (NOT (is_captain AND is_vice_captain));

-- Append-only -> OR REPLACE legal, anon grant survives.
CREATE OR REPLACE VIEW tournament_players_public AS
SELECT tp.id, tp.tournament_id, tp.name, tp.is_active, b.balance,
  CASE WHEN NOT tp.is_active THEN 'inactive'
       WHEN b.balance < 0    THEN 'debt'
       ELSE                       'clear' END AS status,
  tp.is_captain, tp.is_vice_captain
FROM tournament_players tp
JOIN tournament_player_balances b ON b.id = tp.id;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
