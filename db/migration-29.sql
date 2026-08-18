-- ============================================================
-- CricLedger — Migration 29: team-scoped SG views + policy drop
--
-- All eight SuperGiants-side views gain team identity. Every view
-- runs with definer rights (that is how anon reads work over RLS),
-- so under multi-tenancy an unfiltered view is a cross-tenant leak:
-- from here on every *_public row carries team_id and the server
-- filters by it. All rewrites are append-only (new columns last,
-- existing names/types/order unchanged) → CREATE OR REPLACE legal,
-- anon grants survive (migration-7/15/17 precedent).
--
-- pool_balance changes shape on purpose: one row PER TEAM (the old
-- single-row read breaks; callers add a team filter). Zero-entry
-- teams still get a 0 row via the LEFT JOIN.
--
-- players_public now reads the threshold from teams.status_threshold
-- — the ₹900 literal restored by migration-16 dies here.
--
-- anon_read_matches (migration-1's single RLS policy) is DROPPED:
-- it exposed the whole matches table to anon, which under tenancy
-- is every team's fixtures. The three pages reading `matches`
-- directly switch to matches_public (which gains team_id and
-- ground_booking_id — the id link that retires the
-- opponent-name↔booking heuristic from migration-12).
-- ============================================================

-- Internal building block (not anon-granted).
CREATE OR REPLACE VIEW player_balances AS
SELECT
  p.id,
  COALESCE(d.total, 0) + COALESCE(o.total, 0)
    - COALESCE(m.total, 0) - COALESCE(e.total, 0) AS balance,
  p.team_id
FROM players p
LEFT JOIN (SELECT player_id, SUM(amount)     AS total FROM pool_entries
           WHERE kind = 'deposit' GROUP BY player_id) d ON d.player_id = p.id
LEFT JOIN (SELECT player_id, SUM(amount)     AS total FROM pool_entries
           WHERE kind = 'opening_due' GROUP BY player_id) o ON o.player_id = p.id
LEFT JOIN (SELECT player_id, SUM(fee_amount) AS total FROM match_participants
           GROUP BY player_id) m ON m.player_id = p.id
LEFT JOIN (SELECT player_id, SUM(amount)     AS total FROM expense_shares
           GROUP BY player_id) e ON e.player_id = p.id;

-- One row per team now (signed sum, migration-9 rule).
CREATE OR REPLACE VIEW pool_balance AS
SELECT COALESCE(SUM(pe.amount), 0) AS balance,
       t.id   AS team_id,
       t.slug AS team_slug
FROM teams t
LEFT JOIN pool_entries pe ON pe.team_id = t.id
GROUP BY t.id, t.slug;

-- Status threshold comes from the team; ≥ threshold = surplus,
-- ≥ 0 = low, < 0 = debt (unchanged semantics, per-team number).
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
JOIN player_balances b ON b.id = p.id
JOIN teams t ON t.id = p.team_id;

CREATE OR REPLACE VIEW pool_ledger_public AS
SELECT pe.id, pe.entry_date, pe.kind, pe.message, pe.amount,
       a.name AS edited_by,
       pl.name AS player_name,
       pe.team_id
FROM pool_entries pe
LEFT JOIN admins a ON a.id = COALESCE(pe.updated_by, pe.created_by)
LEFT JOIN players pl ON pl.id = pe.player_id
ORDER BY pe.entry_date DESC, pe.created_at DESC;

CREATE OR REPLACE VIEW match_participants_public AS
SELECT mp.match_id,
       pl.name AS player_name,
       mp.brought_car,
       mp.fee_amount,
       pl.is_captain,
       mp.is_playing,
       mp.guest_fee_share,
       mp.team_id
FROM match_participants mp JOIN players pl ON pl.id = mp.player_id;

-- ground_booking_id goes public: bookings link to matches by id now,
-- not by team_name = opponent text. UUIDs expose nothing sensitive.
CREATE OR REPLACE VIEW matches_public AS
SELECT m.id, m.match_date, m.opponent, m.status, m.result,
       m.abandoned_reason, m.ground_fee, m.ball_fee, m.other_fee,
       m.car_allowance_per_car, m.created_at, m.updated_at,
       a.name AS updated_by_name,
       m.guest_names,
       m.guest_cars,
       m.ground,
       m.venue,
       m.fee_paid_to,
       m.team_id,
       m.ground_booking_id
FROM matches m
LEFT JOIN admins a ON a.id = COALESCE(m.updated_by, m.created_by);

-- Every UNION branch carries its source row's team_id; window
-- partition stays player_id (player ids are per-team by construction).
CREATE OR REPLACE VIEW player_statement AS
SELECT
  unified.player_id,
  unified.entry_date,
  unified.kind,
  unified.description,
  unified.delta,
  unified.match_id,
  SUM(unified.delta) OVER (
    PARTITION BY unified.player_id
    ORDER BY unified.entry_date, unified.created_at, unified.source_id
    ROWS UNBOUNDED PRECEDING
  ) AS running_balance,
  unified.created_at,
  unified.source_id,
  a.name AS edited_by,
  unified.team_id
FROM (
  SELECT pe.player_id,
         pe.entry_date,
         pe.created_at,
         'deposit'::text AS kind,
         pe.message      AS description,
         pe.amount       AS delta,
         NULL::uuid      AS match_id,
         pe.id           AS source_id,
         COALESCE(pe.updated_by, pe.created_by) AS editor_id,
         pe.team_id
  FROM pool_entries pe
  WHERE pe.kind = 'deposit'

  UNION ALL

  SELECT pe.player_id,
         pe.entry_date,
         pe.created_at,
         'opening_due'::text,
         pe.message,
         pe.amount,       -- stored negative
         NULL::uuid,
         pe.id,
         COALESCE(pe.updated_by, pe.created_by),
         pe.team_id
  FROM pool_entries pe
  WHERE pe.kind = 'opening_due'

  UNION ALL

  SELECT mp.player_id,
         m.match_date AS entry_date,
         m.created_at,
         CASE WHEN NOT mp.is_playing THEN 'guest_fee'
              WHEN mp.fee_amount < 0 THEN 'driver_rebate'
              ELSE 'match_fee' END,
         'vs ' || m.opponent,
         -mp.fee_amount,
         m.id,
         mp.id,
         COALESCE(m.updated_by, m.created_by),
         mp.team_id
  FROM match_participants mp
  JOIN matches m ON m.id = mp.match_id

  UNION ALL

  SELECT es.player_id,
         pe.entry_date,
         pe.created_at,
         'expense_share'::text,
         pe.message,
         -es.amount,
         NULL::uuid,
         es.id,
         COALESCE(pe.updated_by, pe.created_by),
         es.team_id
  FROM expense_shares es
  JOIN pool_entries pe ON pe.id = es.pool_entry_id
) unified
LEFT JOIN admins a ON a.id = unified.editor_id;

-- id goes public so the match page joins bookings by id.
CREATE OR REPLACE VIEW ground_bookings_public AS
SELECT gb.team_name, gb.captain, gb.amount_pending, gb.created_at,
       gb.id,
       gb.team_id
FROM ground_bookings gb;

-- ---------- matches table leaves the anon read surface ----------

DROP POLICY anon_read_matches ON matches;
REVOKE ALL ON matches FROM anon;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
