-- ============================================================
-- LR-SuperGiants v0 — Migration 2: player_statement view
-- Union of deposits / match fees (incl. driver rebates) / common-
-- expense shares, with a running balance per player. Public — the
-- statement page P5 reads it with the anon key.
-- NOTE: recreated by migration-6 (guest_name column removed).
-- ============================================================

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
  -- Deposits: the only manual way a balance rises
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

  -- Match fees: positive fee = debit; negative (driver) = credit
  SELECT mp.player_id,
         m.match_date AS entry_date,
         m.created_at,
         CASE WHEN mp.fee_amount < 0 THEN 'driver_rebate' ELSE 'match_fee' END,
         'vs ' || m.opponent ||
           CASE WHEN mp.guest_name IS NOT NULL
                THEN ' — guest ' || mp.guest_name ELSE '' END,
         -mp.fee_amount,
         m.id,
         mp.id
  FROM match_participants mp
  JOIN matches m ON m.id = mp.match_id

  UNION ALL

  -- Common-expense shares
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
