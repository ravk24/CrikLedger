-- Migration 40: tenant-keyed balance views, indexes, count views,
--               drop teams.short_name
--
-- Performance plan #3 / #19 / #10 and pending-tasks 4-6, 23.
--
-- 1. player_balances / tournament_player_balances aggregated EVERY
--    tenant's rows on every read: each leg was GROUP BY player_id with no
--    scope column, so a caller's WHERE team_id = … could not be pushed
--    into the aggregate. Every leg now groups by (scope, player) and
--    joins on both keys. Balances are unchanged for every player — the
--    extra key is redundant with the player's own scope; it only lets
--    the planner prune. Verified by diffing the two views before/after.
-- 2. tournament_expense_shares had neither team_id nor tournament_id
--    (migration-19), so its leg could not be scoped. It gains
--    tournament_id, backfilled from its entry, with a composite FK that
--    keeps a share inside its tournament.
-- 3. The FK columns the legs group on had no indexes (the composite-FK
--    rewrite in migration-28 created none on the child side).
-- 4. The ledger views carried an ORDER BY that every caller repeats;
--    dropping it lets the (scope, entry_date DESC, created_at DESC)
--    index serve the caller's order directly.
-- 5. Two count views replace full-row fetches that were counted in JS.
-- 6. teams.short_name was only ever written equal to display_name;
--    titles read display_name from now on.
--
-- Column sets of player_balances, tournament_player_balances,
-- pool_ledger_public and tournament_ledger_public are unchanged, so
-- CREATE OR REPLACE is legal and their dependents stay put. teams_public
-- loses a column → DROP + CREATE. No anon GRANTs: migration-33 locked
-- the schema; the REVOKEs below are belt-and-braces per migration-35.
--
-- Plain CREATE INDEX (not CONCURRENTLY): the runner applies each file
-- inside one transaction. At club-ledger volume the locks are momentary.

BEGIN;

-- ---------- 1. tournament_expense_shares gets its scope ----------
ALTER TABLE tournament_expense_shares
  ADD COLUMN IF NOT EXISTS tournament_id UUID;

UPDATE tournament_expense_shares ts
   SET tournament_id = te.tournament_id
  FROM tournament_entries te
 WHERE te.id = ts.entry_id
   AND ts.tournament_id IS NULL;

ALTER TABLE tournament_expense_shares
  ALTER COLUMN tournament_id SET NOT NULL;

-- A share can only ever point at a player of the same tournament.
ALTER TABLE tournament_expense_shares
  DROP CONSTRAINT IF EXISTS tournament_expense_shares_player_id_fkey;
ALTER TABLE tournament_expense_shares
  ADD CONSTRAINT tes_player_same_tournament
  FOREIGN KEY (tournament_id, player_id)
  REFERENCES tournament_players (tournament_id, id) ON DELETE CASCADE;
ALTER TABLE tournament_expense_shares
  ADD CONSTRAINT tes_tournament_fkey
  FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE;

-- ---------- 2. Tenant-keyed balance views ----------
CREATE OR REPLACE VIEW player_balances AS
SELECT
  p.id,
  COALESCE(d.total, 0) + COALESCE(o.total, 0)
    - COALESCE(m.total, 0) - COALESCE(e.total, 0) AS balance,
  p.team_id
FROM players p
LEFT JOIN (SELECT team_id, player_id, SUM(amount) AS total
             FROM pool_entries
            WHERE kind = 'deposit'
            GROUP BY team_id, player_id) d
       ON d.player_id = p.id AND d.team_id = p.team_id
LEFT JOIN (SELECT team_id, player_id, SUM(amount) AS total
             FROM pool_entries
            WHERE kind = 'opening_due'
            GROUP BY team_id, player_id) o
       ON o.player_id = p.id AND o.team_id = p.team_id
LEFT JOIN (SELECT team_id, player_id, SUM(fee_amount) AS total
             FROM match_participants
            GROUP BY team_id, player_id) m
       ON m.player_id = p.id AND m.team_id = p.team_id
LEFT JOIN (SELECT team_id, player_id, SUM(amount) AS total
             FROM expense_shares
            GROUP BY team_id, player_id) e
       ON e.player_id = p.id AND e.team_id = p.team_id;

CREATE OR REPLACE VIEW tournament_player_balances AS
SELECT
  tp.id,
  COALESCE(d.total, 0) - COALESCE(e.total, 0) - COALESCE(m.total, 0)
    - COALESCE(c.total, 0) AS balance,
  tp.tournament_id
FROM tournament_players tp
LEFT JOIN (SELECT tournament_id, player_id, SUM(amount) AS total
             FROM tournament_entries
            WHERE kind = 'deposit'
            GROUP BY tournament_id, player_id) d
       ON d.player_id = tp.id AND d.tournament_id = tp.tournament_id
LEFT JOIN (SELECT tournament_id, player_id, SUM(amount) AS total
             FROM tournament_expense_shares
            GROUP BY tournament_id, player_id) e
       ON e.player_id = tp.id AND e.tournament_id = tp.tournament_id
LEFT JOIN (SELECT tournament_id, player_id, SUM(fee_amount) AS total
             FROM tournament_match_participants
            GROUP BY tournament_id, player_id) m
       ON m.player_id = tp.id AND m.tournament_id = tp.tournament_id
LEFT JOIN (SELECT tournament_id, player_id, SUM(amount) AS total
             FROM tournament_fee_charges
            GROUP BY tournament_id, player_id) c
       ON c.player_id = tp.id AND c.tournament_id = tp.tournament_id;

-- ---------- 3. Ledger views without the in-view ORDER BY ----------
CREATE OR REPLACE VIEW pool_ledger_public AS
SELECT pe.id, pe.entry_date, pe.kind, pe.message, pe.amount,
       a.name AS edited_by,
       pl.name AS player_name,
       pe.team_id
FROM pool_entries pe
LEFT JOIN admins a ON a.id = COALESCE(pe.updated_by, pe.created_by)
LEFT JOIN players pl ON pl.id = pe.player_id;

CREATE OR REPLACE VIEW tournament_ledger_public AS
SELECT te.id, te.tournament_id, te.entry_date, te.kind, te.message, te.amount,
       a.name  AS edited_by,
       tp.name AS player_name,
       t.team_id
FROM tournament_entries te
LEFT JOIN admins a ON a.id = COALESCE(te.updated_by, te.created_by)
LEFT JOIN tournament_players tp ON tp.id = te.player_id
JOIN tournaments t ON t.id = te.tournament_id;

-- ---------- 4. Count views ----------
-- Attendance per match: a charge-only captain row (is_playing = FALSE)
-- is not attendance, same rule as lib/matches.ts buildAttendeeCounts.
CREATE VIEW match_attendee_counts AS
SELECT team_id, match_id, COUNT(*)::int AS attendee_count
  FROM match_participants
 WHERE is_playing
 GROUP BY team_id, match_id;

-- Cars brought per player, for /car-count.
CREATE VIEW player_car_counts AS
SELECT mp.team_id, mp.player_id, pl.name AS player_name,
       COUNT(*)::int AS car_count
  FROM match_participants mp
  JOIN players pl ON pl.id = mp.player_id
 WHERE mp.brought_car
 GROUP BY mp.team_id, mp.player_id, pl.name;

REVOKE SELECT ON match_attendee_counts, player_car_counts FROM anon;

-- ---------- 5. Indexes ----------
CREATE INDEX IF NOT EXISTS match_participants_team_player_idx
  ON match_participants (team_id, player_id);
CREATE INDEX IF NOT EXISTS match_participants_team_match_playing_idx
  ON match_participants (team_id, match_id) WHERE is_playing;
CREATE INDEX IF NOT EXISTS match_participants_team_player_car_idx
  ON match_participants (team_id, player_id) WHERE brought_car;

CREATE INDEX IF NOT EXISTS expense_shares_team_player_idx
  ON expense_shares (team_id, player_id);

CREATE INDEX IF NOT EXISTS pool_entries_team_player_kind_idx
  ON pool_entries (team_id, player_id) WHERE kind IN ('deposit', 'opening_due');
CREATE INDEX IF NOT EXISTS pool_entries_team_kind_idx
  ON pool_entries (team_id, kind);
CREATE INDEX IF NOT EXISTS pool_entries_team_date_idx
  ON pool_entries (team_id, entry_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS tournament_entries_tournament_player_idx
  ON tournament_entries (tournament_id, player_id);
CREATE INDEX IF NOT EXISTS tournament_entries_tournament_date_idx
  ON tournament_entries (tournament_id, entry_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS tournament_match_participants_tournament_player_idx
  ON tournament_match_participants (tournament_id, player_id);

CREATE INDEX IF NOT EXISTS tournament_expense_shares_tournament_player_idx
  ON tournament_expense_shares (tournament_id, player_id);

CREATE INDEX IF NOT EXISTS tournament_fee_charges_player_idx
  ON tournament_fee_charges (player_id);

CREATE INDEX IF NOT EXISTS tournament_fee_charge_lines_match_idx
  ON tournament_fee_charge_lines (match_id);

-- ---------- 6. Drop teams.short_name ----------
-- teams_public selects it, so the view goes first (CREATE OR REPLACE
-- cannot remove a column — see migration-35). Nothing else selects it.
DROP VIEW teams_public;
ALTER TABLE teams DROP COLUMN short_name;
CREATE VIEW teams_public AS
SELECT id, slug, display_name,
       meeting_point, status_threshold, car_rate_per_km,
       brand_primary_color, brand_secondary_color, logo_ref, is_sandbox, created_at
FROM teams;
REVOKE SELECT ON teams_public FROM anon;

COMMIT;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
