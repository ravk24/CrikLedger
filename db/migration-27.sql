-- ============================================================
-- CricLedger — Migration 27: team_id everywhere + re-scoped uniques
--
-- Order inside this ONE transaction matters:
--   add columns → backfill to team 'our-xi' → NOT NULL → unique swaps.
--
-- Parents (players, matches, pool_entries, ground_bookings,
-- tournaments, admins) get a direct teams FK — CASCADE, so deleting
-- a team wipes it totally (sandbox-purge requirement; the app layer
-- offers no team-delete endpoint otherwise). Children
-- (match_participants, expense_shares) get a bare column chained by
-- migration-28's composite FKs (the
-- tournament_match_participants.tournament_id precedent). Tournament
-- child tables get NO team_id — tournament_id already chains them.
--
-- admins.team_id stays NULLABLE: NULL = platform-level (superadmin).
-- CASCADE, never SET NULL — SET NULL would silently promote a dead
-- team's admins to platform level. The full membership/roles model
-- is Feature 4.
--
-- The re-scoped uniques break the single-team assumptions: player
-- names, captain and vice-captain become per-team (migration-20 is
-- the template — indexing the boolean alone allowed one captain
-- across ALL teams), tournament names become per-team.
-- admins.username stays globally unique (login has no team context).
-- ============================================================

-- ---------- 1. Columns ----------

ALTER TABLE players         ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE matches         ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE pool_entries    ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE ground_bookings ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE tournaments     ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE admins          ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE match_participants ADD COLUMN team_id UUID;  -- chained via composite FKs (m28)
ALTER TABLE expense_shares     ADD COLUMN team_id UUID;  -- chained via composite FKs (m28)

-- ---------- 2. Backfill (idempotent guards; survives real data) ----------

UPDATE players p SET team_id = t.id
  FROM teams t WHERE t.slug = 'our-xi' AND p.team_id IS NULL;
UPDATE matches m SET team_id = t.id
  FROM teams t WHERE t.slug = 'our-xi' AND m.team_id IS NULL;
UPDATE pool_entries pe SET team_id = t.id
  FROM teams t WHERE t.slug = 'our-xi' AND pe.team_id IS NULL;
UPDATE ground_bookings gb SET team_id = t.id
  FROM teams t WHERE t.slug = 'our-xi' AND gb.team_id IS NULL;
UPDATE tournaments tn SET team_id = t.id
  FROM teams t WHERE t.slug = 'our-xi' AND tn.team_id IS NULL;

-- Children derive from their parent row, not from the slug.
UPDATE match_participants mp SET team_id = m.team_id
  FROM matches m WHERE m.id = mp.match_id AND mp.team_id IS NULL;
UPDATE expense_shares es SET team_id = pe.team_id
  FROM pool_entries pe WHERE pe.id = es.pool_entry_id AND es.team_id IS NULL;

-- Team admins join team #1; superadmins stay platform-level (NULL).
UPDATE admins a SET team_id = t.id
  FROM teams t WHERE t.slug = 'our-xi' AND a.role = 'admin' AND a.team_id IS NULL;

-- ---------- 3. NOT NULL (all except admins) ----------

ALTER TABLE players            ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE matches            ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE pool_entries       ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE ground_bookings    ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE tournaments        ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE match_participants ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE expense_shares     ALTER COLUMN team_id SET NOT NULL;

-- ---------- 4. Composite-FK targets (also the team-filter indexes) ----------

ALTER TABLE players         ADD CONSTRAINT players_team_id_key         UNIQUE (team_id, id);
ALTER TABLE matches         ADD CONSTRAINT matches_team_id_key         UNIQUE (team_id, id);
ALTER TABLE pool_entries    ADD CONSTRAINT pool_entries_team_id_key    UNIQUE (team_id, id);
ALTER TABLE ground_bookings ADD CONSTRAINT ground_bookings_team_id_key UNIQUE (team_id, id);

CREATE INDEX matches_team_date_idx ON matches (team_id, match_date);

-- ---------- 5. Re-scoped uniques ----------

ALTER TABLE players DROP CONSTRAINT players_name_key;
ALTER TABLE players ADD  CONSTRAINT players_team_name_key UNIQUE (team_id, name);

-- One captain / vice-captain PER TEAM, enforced by the database.
DROP INDEX players_one_captain;
CREATE UNIQUE INDEX players_one_captain
  ON players (team_id) WHERE is_captain;
DROP INDEX players_one_vice_captain;
CREATE UNIQUE INDEX players_one_vice_captain
  ON players (team_id) WHERE is_vice_captain;

ALTER TABLE tournaments DROP CONSTRAINT tournaments_name_key;
ALTER TABLE tournaments ADD  CONSTRAINT tournaments_team_name_key UNIQUE (team_id, name);

-- PostgREST caches the schema; new columns 404 until reload.
NOTIFY pgrst, 'reload schema';
