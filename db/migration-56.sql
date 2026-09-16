-- ============================================================
-- Migration 56: tournament ledger gains the team ledger's manual kinds
--
-- Until now a tournament fund could only take a player deposit and a
-- shared (common) expense, entered from the Admin tab's two money
-- tiles. From this migration the tournament Ledger tab carries the
-- same Credit / Debit sheets as the team pool (minus the season due,
-- which has no meaning inside a tournament), so tournament_entries
-- learns three more kinds:
--
--   * other_income  (+)  — a credit that raises only the fund
--   * plain_debit   (−)  — an expense that lowers only the fund
--   * withdrawal    (−)  — player-linked: a player takes part of their
--                          deposit back; lowers the fund AND the player
--                          (team-side twin: migration 55)
--
--   * tournament_entries_kind_check and t_sign_matches_kind are swapped
--     (TEXT + CHECK since migration 19 — no ALTER TYPE, so this file
--     runs as ONE transaction; migrations 22 and 23 did the same).
--   * t_withdrawal_has_player mirrors t_deposit_has_player.
--   * tournament_player_balances (migration 40) sums withdrawals in the
--     deposit leg; tournament_player_statement (migration 30) gains a
--     withdrawal branch so the row shows on the player's page.
--
-- tournaments_public.fund_balance is an unfiltered signed sum and
-- tournament_ledger_public already joins tournament_players for
-- player_name (migration 42) — nothing to change there. The composite
-- FK t_entry_player_same_tournament (migration 19) is kind-agnostic.
--
-- Both views are re-created WITH (security_invoker = true): migration
-- 47 set that option by ALTER VIEW, and CREATE OR REPLACE VIEW drops
-- it unless restated (migration 48's rule). Runs as ONE transaction.
-- ============================================================

BEGIN;

ALTER TABLE tournament_entries DROP CONSTRAINT tournament_entries_kind_check;
ALTER TABLE tournament_entries ADD CONSTRAINT tournament_entries_kind_check
  CHECK (kind IN ('deposit','other_income','plain_debit','common_debit','withdrawal',
                  'match_collection','joining_fee','tournament_collection'));

ALTER TABLE tournament_entries DROP CONSTRAINT t_sign_matches_kind;
ALTER TABLE tournament_entries ADD CONSTRAINT t_sign_matches_kind CHECK (
  (kind IN ('deposit','other_income','match_collection','tournament_collection') AND amount > 0) OR
  (kind IN ('plain_debit','common_debit','withdrawal','joining_fee') AND amount < 0)
);

ALTER TABLE tournament_entries ADD CONSTRAINT t_withdrawal_has_player
  CHECK (kind <> 'withdrawal' OR player_id IS NOT NULL);

-- Same view as migration 40; the deposit leg now also sums
-- withdrawals (negative, so the plain SUM subtracts them).
CREATE OR REPLACE VIEW tournament_player_balances
  WITH (security_invoker = true) AS
SELECT
  tp.id,
  COALESCE(d.total, 0) - COALESCE(e.total, 0) - COALESCE(m.total, 0)
    - COALESCE(c.total, 0) AS balance,
  tp.tournament_id
FROM tournament_players tp
LEFT JOIN (SELECT tournament_id, player_id, SUM(amount) AS total
             FROM tournament_entries
            WHERE kind IN ('deposit', 'withdrawal')
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

-- Same view as migration 30 plus the withdrawal branch.
CREATE OR REPLACE VIEW tournament_player_statement
  WITH (security_invoker = true) AS
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
  SELECT te.player_id, te.entry_date, te.created_at,
         'withdrawal'::text, te.message,
         te.amount,   -- stored negative
         te.id,
         NULL::uuid,
         COALESCE(te.updated_by, te.created_by),
         te.tournament_id
  FROM tournament_entries te
  WHERE te.kind = 'withdrawal'
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

COMMIT;

-- PostgREST caches the schema; the new kinds 404 until it reloads.
NOTIFY pgrst, 'reload schema';
