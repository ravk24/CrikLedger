-- ============================================================
-- LR-SuperGiants v1 — Migration 7: captain role + guest billing
--
-- One standing captain for the whole group (superadmin-declared,
-- not per match). Guests now count in the fee split (per-head =
-- ceil(pot / (players + guests)), guest cars join the pot like
-- player cars) and their charges are deducted from the CAPTAIN's
-- balance — guests hand him cash offline. The charge is stored as
-- match_participants rows (merged into the captain's own row when
-- he plays, else an is_playing = FALSE row), so player_balances,
-- player_statement, pool_balance, and the completion surplus math
-- keep working unchanged.
-- ============================================================

ALTER TABLE players ADD COLUMN is_captain BOOLEAN NOT NULL DEFAULT FALSE;

-- At most one captain, enforced by the database.
CREATE UNIQUE INDEX players_one_captain ON players (is_captain) WHERE is_captain;

-- Index-aligned with guest_names; legacy matches keep '{}' = all false.
ALTER TABLE matches ADD COLUMN guest_cars BOOLEAN[] NOT NULL DEFAULT '{}';

-- guest_fee_share: the slice of fee_amount that is guest money
-- (display + legacy detection); is_playing = FALSE marks the
-- charge-only captain row when he did not attend.
ALTER TABLE match_participants
  ADD COLUMN guest_fee_share NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN is_playing BOOLEAN NOT NULL DEFAULT TRUE;

-- A non-playing row exists only to carry guest fees.
ALTER TABLE match_participants
  ADD CONSTRAINT non_playing_is_guest_charge
  CHECK (is_playing OR fee_amount = guest_fee_share);

-- ---- Views (append-only or same column list -> OR REPLACE legal,
--      grants survive) --------------------------------------------

CREATE OR REPLACE VIEW players_public AS
SELECT
  p.id,
  p.name,
  p.is_active,
  b.balance,
  CASE
    WHEN NOT p.is_active   THEN 'inactive'
    WHEN b.balance > 200   THEN 'surplus'   -- green
    WHEN b.balance >= 0    THEN 'low'       -- orange
    ELSE                        'debt'      -- red
  END AS status,
  p.is_captain
FROM players p JOIN player_balances b ON b.id = p.id;

CREATE OR REPLACE VIEW match_participants_public AS
SELECT mp.match_id,
       pl.name AS player_name,
       mp.brought_car,
       mp.fee_amount,
       pl.is_captain,
       mp.is_playing,
       mp.guest_fee_share
FROM match_participants mp JOIN players pl ON pl.id = mp.player_id;

CREATE OR REPLACE VIEW matches_public AS
SELECT m.id, m.match_date, m.opponent, m.status, m.result,
       m.abandoned_reason, m.ground_fee, m.ball_fee, m.other_fee,
       m.car_allowance_per_car, m.created_at, m.updated_at,
       a.name AS updated_by_name,
       m.guest_names,
       m.guest_cars
FROM matches m
LEFT JOIN admins a ON a.id = COALESCE(m.updated_by, m.created_by);

-- Same column list as migration-6; only the kind label logic gains
-- the guest_fee case for charge-only captain rows.
CREATE OR REPLACE VIEW player_statement AS
SELECT
  player_id,
  entry_date,
  kind,
  description,
  delta,
  match_id,
  SUM(delta) OVER (
    PARTITION BY player_id
    ORDER BY entry_date, created_at, source_id
    ROWS UNBOUNDED PRECEDING
  ) AS running_balance,
  created_at,
  source_id
FROM (
  SELECT pe.player_id,
         pe.entry_date,
         pe.created_at,
         'deposit'::text AS kind,
         pe.message      AS description,
         pe.amount       AS delta,
         NULL::uuid      AS match_id,
         pe.id           AS source_id
  FROM pool_entries pe
  WHERE pe.kind = 'deposit'

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
         mp.id
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
         es.id
  FROM expense_shares es
  JOIN pool_entries pe ON pe.id = es.pool_entry_id
) unified;

-- PostgREST caches the schema; new columns 404 until reload.
NOTIFY pgrst, 'reload schema';
