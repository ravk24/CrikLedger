-- Migration 45: the tenant filter finally reaches the balance aggregates;
--               tournaments_public aggregates per row; a tournament
--               attendee-count view; four supporting indexes
--
-- Performance plan v2 items C1, C2, C4, C5.
--
-- 1. Migration 40 keyed every leg of player_balances /
--    tournament_player_balances by (scope, player) so a caller's
--    WHERE team_id = … could be pushed into the aggregate. But nothing
--    reads those views directly: players_public and
--    tournament_players_public join them ON b.id = p.id ONLY. After the
--    planner flattens the view the outer team_id restriction binds to the
--    OUTER players row, the legs correlate to the balance view's INNER
--    players alias, and the only equality between the two is the id —
--    Postgres does not infer p_inner.team_id = p_outer.team_id through a
--    primary key. So every Home / Pool / Admin render still aggregated
--    every tenant's pool_entries, match_participants and expense_shares
--    (EXPLAIN 2026-08-26: HashAggregate over Seq Scan, no Index Cond).
--    Adding `AND b.team_id = p.team_id` to the join puts both team_id
--    columns in one equivalence class with the constant and the qual
--    pushes down. Balances are unchanged for every player — the extra
--    predicate is redundant with the FK that keeps a participant inside
--    its player's team (migration 28). Verified by diffing the full view
--    output before/after on prod (byte-identical).
-- 2. tournaments_public's fund_balance and player_count legs grouped by
--    tournament_id only, so the directory's WHERE team_id = … scanned
--    every tournament's entries. Correlated scalar subqueries cost one
--    index probe per tournament row instead, whatever the filter.
-- 3. tournament_match_attendee_counts mirrors migration 40's
--    match_attendee_counts so the tournament Completed tab stops
--    fetching every participant row to count them in JS.
-- 4. Indexes for the exact predicate + order the pages use.
--
-- Column sets are unchanged, so CREATE OR REPLACE is legal everywhere
-- and dependents stay put. Plain CREATE INDEX (not CONCURRENTLY): the
-- runner applies each file inside one transaction.

BEGIN;

-- ---------- 1. Join the balance views on both keys ----------
CREATE OR REPLACE VIEW players_public AS
SELECT
  p.id,
  p.name,
  p.is_active,
  b.balance,
  CASE
    WHEN NOT p.is_active                  THEN 'inactive'
    WHEN b.balance >= t.status_threshold  THEN 'surplus'   -- green
    WHEN b.balance >= 0                   THEN 'low'       -- orange
    ELSE                                       'debt'      -- red
  END AS status,
  p.is_captain,
  p.is_vice_captain,
  p.team_id
FROM players p
JOIN player_balances b ON b.id = p.id AND b.team_id = p.team_id
JOIN teams t ON t.id = p.team_id;

CREATE OR REPLACE VIEW tournament_players_public AS
SELECT tp.id, tp.tournament_id, tp.name, tp.is_active, b.balance,
  CASE WHEN NOT tp.is_active THEN 'inactive'
       WHEN b.balance < 0    THEN 'debt'
       ELSE                       'clear' END AS status,
  tp.is_captain, tp.is_vice_captain,
  t.team_id
FROM tournament_players tp
JOIN tournament_player_balances b
  ON b.id = tp.id AND b.tournament_id = tp.tournament_id
JOIN tournaments t ON t.id = tp.tournament_id;

-- ---------- 2. tournaments_public: per-row aggregates ----------
CREATE OR REPLACE VIEW tournaments_public AS
SELECT t.id, t.name, t.season_label, t.start_date, t.end_date, t.status,
       COALESCE((SELECT SUM(te.amount)
                   FROM tournament_entries te
                  WHERE te.tournament_id = t.id), 0) AS fund_balance,
       COALESCE((SELECT COUNT(*) FILTER (WHERE tp.is_active)
                   FROM tournament_players tp
                  WHERE tp.tournament_id = t.id), 0) AS player_count,
       t.created_at,
       t.team_name, t.venue,
       t.joining_fee,
       t.team_id
FROM tournaments t;

-- ---------- 3. Tournament attendee counts ----------
-- Every participant row is attendance here (no charge-only rows in
-- tournaments — the settlement writes charges to its own table).
CREATE VIEW tournament_match_attendee_counts AS
SELECT tournament_id, match_id, COUNT(*)::int AS attendee_count
  FROM tournament_match_participants
 GROUP BY tournament_id, match_id;

REVOKE SELECT ON tournament_match_attendee_counts FROM anon;

-- ---------- 4. Indexes ----------
-- /schedule/upcoming and /schedule/completed: team + status, ordered by date.
CREATE INDEX IF NOT EXISTS matches_team_status_date_idx
  ON matches (team_id, status, match_date DESC);

-- Home's "last collection": team + kind, newest first, LIMIT 1.
CREATE INDEX IF NOT EXISTS pool_entries_team_kind_date_idx
  ON pool_entries (team_id, kind, entry_date DESC, created_at DESC);

-- The tournaments directory (newest 50).
CREATE INDEX IF NOT EXISTS tournaments_created_idx
  ON tournaments (created_at DESC);

-- /ops joins entitlements to admins.
CREATE INDEX IF NOT EXISTS entitlements_admin_idx
  ON entitlements (admin_id);

-- The new count view groups by (tournament_id, match_id).
CREATE INDEX IF NOT EXISTS tournament_match_participants_tournament_match_idx
  ON tournament_match_participants (tournament_id, match_id);

COMMIT;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
