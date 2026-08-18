-- ============================================================
-- CricLedger — Migration 30: team-scoped tournament views
--
-- Tournament tables need no team_id of their own (tournament_id
-- chains isolation to tournaments.team_id, migration-27), but the
-- nine tournament views must EXPOSE team identity so server reads
-- filter by team — same leak logic as migration-29. All rewrites
-- are append-only → CREATE OR REPLACE legal, anon grants survive.
-- Views already carrying tournament_id just append team_id (join
-- tournaments); tournament_player_statement appends BOTH (each
-- UNION branch carries its source row's tournament_id).
-- ============================================================

-- Internal building block (not anon-granted); tournament_id was
-- never exposed here — append it for scoped internal reads.
CREATE OR REPLACE VIEW tournament_player_balances AS
SELECT
  tp.id,
  COALESCE(d.total, 0) - COALESCE(e.total, 0) - COALESCE(m.total, 0)
    - COALESCE(c.total, 0) AS balance,
  tp.tournament_id
FROM tournament_players tp
LEFT JOIN (SELECT player_id, SUM(amount) AS total
           FROM tournament_entries
           WHERE kind = 'deposit'
           GROUP BY player_id) d ON d.player_id = tp.id
LEFT JOIN (SELECT player_id, SUM(amount) AS total
           FROM tournament_expense_shares
           GROUP BY player_id) e ON e.player_id = tp.id
LEFT JOIN (SELECT player_id, SUM(fee_amount) AS total
           FROM tournament_match_participants
           GROUP BY player_id) m ON m.player_id = tp.id
LEFT JOIN (SELECT player_id, SUM(amount) AS total
           FROM tournament_fee_charges
           GROUP BY player_id) c ON c.player_id = tp.id;

CREATE OR REPLACE VIEW tournaments_public AS
SELECT t.id, t.name, t.season_label, t.start_date, t.end_date, t.status,
       COALESCE(f.balance, 0) AS fund_balance,
       COALESCE(pc.count, 0)  AS player_count,
       t.created_at,
       t.team_name, t.venue,
       t.joining_fee,
       t.team_id
FROM tournaments t
LEFT JOIN (SELECT tournament_id, SUM(amount) AS balance
           FROM tournament_entries
           GROUP BY tournament_id) f ON f.tournament_id = t.id
LEFT JOIN (SELECT tournament_id, COUNT(*) FILTER (WHERE is_active) AS count
           FROM tournament_players
           GROUP BY tournament_id) pc ON pc.tournament_id = t.id;

CREATE OR REPLACE VIEW tournament_players_public AS
SELECT tp.id, tp.tournament_id, tp.name, tp.is_active, b.balance,
  CASE WHEN NOT tp.is_active THEN 'inactive'
       WHEN b.balance < 0    THEN 'debt'
       ELSE                       'clear' END AS status,
  tp.is_captain, tp.is_vice_captain,
  t.team_id
FROM tournament_players tp
JOIN tournament_player_balances b ON b.id = tp.id
JOIN tournaments t ON t.id = tp.tournament_id;

CREATE OR REPLACE VIEW tournament_ledger_public AS
SELECT te.id, te.tournament_id, te.entry_date, te.kind, te.message, te.amount,
       a.name  AS edited_by,
       tp.name AS player_name,
       t.team_id
FROM tournament_entries te
LEFT JOIN admins a ON a.id = COALESCE(te.updated_by, te.created_by)
LEFT JOIN tournament_players tp ON tp.id = te.player_id
JOIN tournaments t ON t.id = te.tournament_id
ORDER BY te.entry_date DESC, te.created_at DESC;

-- Each branch carries its source row's tournament_id; the outer
-- join to tournaments resolves team_id.
CREATE OR REPLACE VIEW tournament_player_statement AS
SELECT unified.player_id, unified.entry_date, unified.kind,
       unified.description, unified.delta,
  SUM(unified.delta) OVER (PARTITION BY unified.player_id
                           ORDER BY unified.entry_date, unified.created_at,
                                    unified.source_id
                           ROWS UNBOUNDED PRECEDING) AS running_balance,
  unified.created_at, unified.source_id,
  unified.match_id,
  a.name AS edited_by,
  unified.tournament_id,
  t.team_id
FROM (
  SELECT te.player_id, te.entry_date, te.created_at,
         'deposit'::text AS kind, te.message AS description,
         te.amount AS delta, te.id AS source_id,
         NULL::uuid AS match_id,
         COALESCE(te.updated_by, te.created_by) AS editor_id,
         te.tournament_id
  FROM tournament_entries te
  WHERE te.kind = 'deposit'
  UNION ALL
  SELECT ts.player_id, te.entry_date, te.created_at,
         'expense_share'::text, te.message, -ts.amount, ts.id,
         NULL::uuid,
         COALESCE(te.updated_by, te.created_by),
         te.tournament_id
  FROM tournament_expense_shares ts
  JOIN tournament_entries te ON te.id = ts.entry_id
  UNION ALL
  SELECT tmp.player_id, tm.match_date, tm.created_at,
         CASE WHEN tmp.fee_amount < 0 THEN 'driver_rebate'
              ELSE 'match_fee' END,
         'vs ' || tm.opponent, -tmp.fee_amount, tmp.id,
         tm.id,
         COALESCE(tm.updated_by, tm.created_by),
         tm.tournament_id
  FROM tournament_match_participants tmp
  JOIN tournament_matches tm ON tm.id = tmp.match_id
  WHERE tmp.fee_amount <> 0   -- attendance-only rows are not statement lines
  UNION ALL
  SELECT tfc.player_id, tfc.created_at::date, tfc.created_at,
         'tournament_fee'::text,
         'Tournament fee (' || tfc.played ||
           CASE WHEN tfc.played = 1 THEN ' match' ELSE ' matches' END || ')',
         -tfc.amount, tfc.id,
         NULL::uuid,
         NULL::uuid,
         tfc.tournament_id
  FROM tournament_fee_charges tfc
) unified
LEFT JOIN admins a ON a.id = unified.editor_id
JOIN tournaments t ON t.id = unified.tournament_id;

CREATE OR REPLACE VIEW tournament_matches_public AS
SELECT tm.id, tm.tournament_id, tm.match_date, tm.match_time, tm.opponent,
       tm.status, tm.result, tm.abandoned_reason, tm.ground_fee, tm.ball_fee,
       tm.other_fee, tm.car_allowance_per_car, tm.created_at, tm.updated_at,
       a.name AS updated_by_name,
       t.team_id
FROM tournament_matches tm
LEFT JOIN admins a ON a.id = COALESCE(tm.updated_by, tm.created_by)
JOIN tournaments t ON t.id = tm.tournament_id;

CREATE OR REPLACE VIEW tournament_match_participants_public AS
SELECT tmp.match_id, tmp.tournament_id, tp.name AS player_name,
       tmp.brought_car, tmp.fee_amount, tp.is_captain,
       TRUE AS is_playing, 0::numeric AS guest_fee_share,
       t.team_id
FROM tournament_match_participants tmp
JOIN tournament_players tp ON tp.id = tmp.player_id
JOIN tournaments t ON t.id = tmp.tournament_id;

CREATE OR REPLACE VIEW tournament_fee_breakdown_public AS
SELECT l.tournament_id,
       l.player_id,
       l.match_id,
       tm.match_date,
       tm.match_time,
       tm.opponent,
       l.share,
       l.driver_credit,
       t.team_id
FROM tournament_fee_charge_lines l
JOIN tournament_matches tm ON tm.id = l.match_id
JOIN tournaments t ON t.id = l.tournament_id;

CREATE OR REPLACE VIEW tournament_fee_charges_public AS
SELECT tfc.tournament_id, tfc.player_id, tfc.played,
       tfc.driver_credit, tfc.amount, tfc.created_at,
       t.team_id
FROM tournament_fee_charges tfc
JOIN tournaments t ON t.id = tfc.tournament_id;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
