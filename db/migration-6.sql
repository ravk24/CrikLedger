-- ============================================================
-- LR-SuperGiants v1 — Migration 6: guests are display-only
--
-- New team rule: the captain collects guest fees offline and the
-- admin edits the captain's fee row to reflect the net. The app
-- does zero guest math: guests are not charged to a host and are
-- not counted in the fee split. Guest NAMES are kept on the match
-- (matches.guest_names) purely so match pages show who played.
-- ============================================================

ALTER TABLE matches ADD COLUMN guest_names TEXT[] NOT NULL DEFAULT '{}';

-- Fold existing guest participant rows into guest_names, then drop them.
UPDATE matches m
SET guest_names = sub.names
FROM (SELECT match_id, array_agg(guest_name ORDER BY guest_name) AS names
      FROM match_participants WHERE guest_name IS NOT NULL
      GROUP BY match_id) sub
WHERE sub.match_id = m.id;

DELETE FROM match_participants WHERE guest_name IS NOT NULL;

-- Recompute surplus rows for affected matches (same rule as the app:
-- surplus = SUM(fee_amount) - cash costs; row exists only when > 0).
UPDATE pool_entries pe
SET amount = s.collected - (m.ground_fee + m.ball_fee + m.other_fee)
FROM matches m,
LATERAL (SELECT COALESCE(SUM(fee_amount), 0) AS collected
         FROM match_participants WHERE match_id = m.id) s
WHERE pe.kind = 'match_collection' AND pe.match_id = m.id
  AND s.collected > m.ground_fee + m.ball_fee + m.other_fee;

DELETE FROM pool_entries pe
USING matches m,
LATERAL (SELECT COALESCE(SUM(fee_amount), 0) AS collected
         FROM match_participants WHERE match_id = m.id) s
WHERE pe.kind = 'match_collection' AND pe.match_id = m.id
  AND s.collected <= m.ground_fee + m.ball_fee + m.other_fee;

-- Participant rows are now players-only.
ALTER TABLE match_participants DROP CONSTRAINT guests_dont_drive;
ALTER TABLE match_participants DROP CONSTRAINT one_self_row_per_match;
ALTER TABLE match_participants
  ADD CONSTRAINT one_row_per_player_per_match UNIQUE (match_id, player_id);

-- match_participants_public and player_statement select guest_name
-- -> drop both, drop the column, recreate both, re-grant.
DROP VIEW match_participants_public;
DROP VIEW player_statement;
ALTER TABLE match_participants DROP COLUMN guest_name;

CREATE VIEW match_participants_public AS
SELECT mp.match_id,
       pl.name AS player_name,
       mp.brought_car,
       mp.fee_amount
FROM match_participants mp JOIN players pl ON pl.id = mp.player_id;

GRANT SELECT ON match_participants_public TO anon;

-- Same as migration-2, minus the "— guest X" description suffix.
CREATE VIEW player_statement AS
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
         CASE WHEN mp.fee_amount < 0 THEN 'driver_rebate' ELSE 'match_fee' END,
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

GRANT SELECT ON player_statement TO anon;

-- matches_public gains the new column (append-only, OR REPLACE is legal).
CREATE OR REPLACE VIEW matches_public AS
SELECT m.id, m.match_date, m.opponent, m.status, m.result,
       m.abandoned_reason, m.ground_fee, m.ball_fee, m.other_fee,
       m.car_allowance_per_car, m.created_at, m.updated_at,
       a.name AS updated_by_name,
       m.guest_names
FROM matches m
LEFT JOIN admins a ON a.id = COALESCE(m.updated_by, m.created_by);

NOTIFY pgrst, 'reload schema';
