-- ============================================================
-- Migration 55: withdrawals — a player takes part of their stake back
--
-- Until now the only way to record money returned to a player was to
-- shrink their deposit row, which rewrites history. From this
-- migration the ledger has its own line for it:
--
--   * pool_entry_kind gains 'withdrawal'. Player-linked, stored
--     NEGATIVE (like opening_due, migration 8), entered from the
--     Debit sheet with a player picker. It lowers the pool AND the
--     named player's balance — the settlement entry that
--     POST /api/players/[id]/deactivate has always asked for.
--   * sign_matches_kind puts it in the amount < 0 list;
--     withdrawal_has_player mirrors deposit_has_player.
--   * player_balances (migration 40) sums it beside deposits;
--     player_statement (migration 29) gains a fifth UNION branch so
--     the row shows on the player's page with a running balance.
--   * pool_entries_team_player_kind_idx (migration 40) widens its
--     WHERE to the three player-linked kinds.
--
-- pool_balance is an unfiltered signed sum (migration 29) and
-- pool_ledger_public already joins players for player_name
-- (migration 54) — nothing to change there. pe_player_same_team
-- (migration 28) is kind-agnostic, so the composite FK needs no work.
--
-- Both views are re-created WITH (security_invoker = true): migration
-- 47 set that option by ALTER VIEW, and CREATE OR REPLACE VIEW drops
-- it unless restated (migration 48's rule).
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction
-- that also USES the new value — run each statement separately
-- (autocommit), in order (same convention as migrations 4, 8 and 54;
-- db/apply-migrations.mjs lists this file in AUTOCOMMIT_FILES).
-- A BEGIN…ROLLBACK dry-run therefore stops at the sign_matches_kind
-- re-add with "unsafe use of new value" — expected, not a defect.
-- ============================================================

ALTER TYPE pool_entry_kind ADD VALUE IF NOT EXISTS 'withdrawal';

ALTER TABLE pool_entries DROP CONSTRAINT sign_matches_kind;
ALTER TABLE pool_entries ADD CONSTRAINT sign_matches_kind CHECK (
  (kind IN ('deposit','other_income','match_collection','expense_recovery',
            'ground_booking','equipment') AND amount > 0) OR
  (kind IN ('plain_debit','common_debit','opening_due','withdrawal') AND amount < 0) OR
  (kind = 'match_refund' AND amount <> 0)
);

ALTER TABLE pool_entries ADD CONSTRAINT withdrawal_has_player
  CHECK (kind <> 'withdrawal' OR player_id IS NOT NULL);

-- Same view as migration 40; the deposit leg now also sums
-- withdrawals (negative, so the plain SUM subtracts them).
CREATE OR REPLACE VIEW player_balances
  WITH (security_invoker = true) AS
SELECT
  p.id,
  COALESCE(d.total, 0) + COALESCE(o.total, 0)
    - COALESCE(m.total, 0) - COALESCE(e.total, 0) AS balance,
  p.team_id
FROM players p
LEFT JOIN (SELECT team_id, player_id, SUM(amount) AS total
             FROM pool_entries
            WHERE kind IN ('deposit', 'withdrawal')
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

-- Same view as migration 29 plus the withdrawal branch.
CREATE OR REPLACE VIEW player_statement
  WITH (security_invoker = true) AS
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

  SELECT pe.player_id,
         pe.entry_date,
         pe.created_at,
         'withdrawal'::text,
         pe.message,
         pe.amount,       -- stored negative
         NULL::uuid,
         pe.id,
         COALESCE(pe.updated_by, pe.created_by),
         pe.team_id
  FROM pool_entries pe
  WHERE pe.kind = 'withdrawal'

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

DROP INDEX IF EXISTS pool_entries_team_player_kind_idx;
CREATE INDEX pool_entries_team_player_kind_idx
  ON pool_entries (team_id, player_id)
  WHERE kind IN ('deposit', 'opening_due', 'withdrawal');

-- PostgREST caches the schema; the new kind 404s until it reloads.
NOTIFY pgrst, 'reload schema';
