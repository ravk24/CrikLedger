-- ============================================================
-- LR-SuperGiants v2 — Migration 11: player_statement edited_by
--
-- The statement page gains pool-ledger-style expandable rows that
-- show "entry by <admin>". Appends edited_by to player_statement
-- (append-only -> OR REPLACE legal, anon grant survives): the
-- admin who last touched the source row, exactly how
-- pool_ledger_public derives it. Admin names are already public
-- there, so this exposes nothing new.
-- ============================================================

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
  a.name AS edited_by
FROM (
  SELECT pe.player_id,
         pe.entry_date,
         pe.created_at,
         'deposit'::text AS kind,
         pe.message      AS description,
         pe.amount       AS delta,
         NULL::uuid      AS match_id,
         pe.id           AS source_id,
         COALESCE(pe.updated_by, pe.created_by) AS editor_id
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
         COALESCE(pe.updated_by, pe.created_by)
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
         COALESCE(m.updated_by, m.created_by)
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
         COALESCE(pe.updated_by, pe.created_by)
  FROM expense_shares es
  JOIN pool_entries pe ON pe.id = es.pool_entry_id
) unified
LEFT JOIN admins a ON a.id = unified.editor_id;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
