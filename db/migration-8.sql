-- ============================================================
-- LR-SuperGiants v1 — Migration 8: season-2 opening dues
--
-- Some players carry unpaid dues from season 1. New pool_entry_kind
-- 'opening_due': player-linked, stored NEGATIVE. It lowers the
-- player's balance (red on the dashboard) but is EXCLUDED from the
-- pool balance — a due is a receivable, not cash the pool holds.
-- When the player later deposits, the pool gains and their balance
-- recovers.
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction
-- that also USES the new value — run each statement separately
-- (autocommit), in order (same convention as migration-4).
-- ============================================================

ALTER TYPE pool_entry_kind ADD VALUE IF NOT EXISTS 'opening_due';

ALTER TABLE pool_entries DROP CONSTRAINT sign_matches_kind;
ALTER TABLE pool_entries ADD CONSTRAINT sign_matches_kind CHECK (
  (kind IN ('deposit','other_income','match_collection','expense_recovery',
            'ground_booking','equipment') AND amount > 0) OR
  (kind IN ('plain_debit','common_debit','opening_due') AND amount < 0)
);

ALTER TABLE pool_entries ADD CONSTRAINT opening_due_has_player
  CHECK (kind <> 'opening_due' OR player_id IS NOT NULL);

-- Player balance now includes opening dues (negative amounts).
CREATE OR REPLACE VIEW player_balances AS
SELECT
  p.id,
  COALESCE(d.total, 0) + COALESCE(o.total, 0)
    - COALESCE(m.total, 0) - COALESCE(e.total, 0) AS balance
FROM players p
LEFT JOIN (SELECT player_id, SUM(amount)     AS total FROM pool_entries
           WHERE kind = 'deposit' GROUP BY player_id) d ON d.player_id = p.id
LEFT JOIN (SELECT player_id, SUM(amount)     AS total FROM pool_entries
           WHERE kind = 'opening_due' GROUP BY player_id) o ON o.player_id = p.id
LEFT JOIN (SELECT player_id, SUM(fee_amount) AS total FROM match_participants
           GROUP BY player_id) m ON m.player_id = p.id
LEFT JOIN (SELECT player_id, SUM(amount)     AS total FROM expense_shares
           GROUP BY player_id) e ON e.player_id = p.id;

-- Dues are receivables, not pool cash.
CREATE OR REPLACE VIEW pool_balance AS
SELECT COALESCE(SUM(amount), 0) AS balance
FROM pool_entries
WHERE kind <> 'opening_due';

-- Same column list as migration-7; adds the opening_due branch.
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

  SELECT pe.player_id,
         pe.entry_date,
         pe.created_at,
         'opening_due'::text,
         pe.message,
         pe.amount,       -- stored negative
         NULL::uuid,
         pe.id
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

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
