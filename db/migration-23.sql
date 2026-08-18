-- ============================================================
-- LR-SuperGiants v2 — Migration 23: tournament participation fee
--
-- Tournaments switch from per-match money to ONE joining fee
-- (organiser provides balls/equipment/refreshments). Matches now
-- record attendance + car fee only; the money settles when the
-- admin clicks "Mark as completed":
--   pot      = joining_fee + Σ(match cars × that match's car fee)
--   perSlot  = CEIL(pot ÷ total match-slots)   -- favors the fund
--   charge   = perSlot × matches played − their driver credits
-- Settlement writes: per-player charge rows (tournament_fee_charges,
-- participants pattern — charges can be negative for heavy drivers),
-- one 'joining_fee' debit (the payout), and one
-- 'tournament_collection' credit (the ceil surplus). Reopening the
-- tournament deletes all of them; derived balances restore.
-- Fund = deposits − joining_fee + surplus mirrors the cash box.
--
-- 'match_collection' stays legal for legacy rows but is never
-- written again (new match completions charge nothing).
-- ============================================================

ALTER TABLE tournaments ADD COLUMN joining_fee NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Append-only -> OR REPLACE legal, anon grant survives.
CREATE OR REPLACE VIEW tournaments_public AS
SELECT t.id, t.name, t.season_label, t.start_date, t.end_date, t.status,
       COALESCE(f.balance, 0) AS fund_balance,
       COALESCE(pc.count, 0)  AS player_count,
       t.created_at,
       t.team_name, t.venue,
       t.joining_fee
FROM tournaments t
LEFT JOIN (SELECT tournament_id, SUM(amount) AS balance
           FROM tournament_entries
           GROUP BY tournament_id) f ON f.tournament_id = t.id
LEFT JOIN (SELECT tournament_id, COUNT(*) FILTER (WHERE is_active) AS count
           FROM tournament_players
           GROUP BY tournament_id) pc ON pc.tournament_id = t.id;

-- New auto kinds (constraint swap — the TEXT+CHECK payoff).
ALTER TABLE tournament_entries DROP CONSTRAINT tournament_entries_kind_check;
ALTER TABLE tournament_entries ADD CONSTRAINT tournament_entries_kind_check
  CHECK (kind IN ('deposit','common_debit','match_collection',
                  'joining_fee','tournament_collection'));

ALTER TABLE tournament_entries DROP CONSTRAINT t_sign_matches_kind;
ALTER TABLE tournament_entries ADD CONSTRAINT t_sign_matches_kind CHECK (
  (kind IN ('deposit','match_collection','tournament_collection') AND amount > 0) OR
  (kind IN ('common_debit','joining_fee') AND amount < 0)
);

-- One settlement per tournament, enforced by the database.
CREATE UNIQUE INDEX tournament_entries_one_joining_fee
  ON tournament_entries (tournament_id) WHERE kind = 'joining_fee';
CREATE UNIQUE INDEX tournament_entries_one_collection
  ON tournament_entries (tournament_id) WHERE kind = 'tournament_collection';

-- Per-player settlement rows. NOT ledger entries because a heavy
-- driver's net charge can be NEGATIVE (a credit). Replaced wholesale
-- on every settlement, deleted on reopen.
CREATE TABLE tournament_fee_charges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL,
  player_id     UUID NOT NULL,
  played        INT NOT NULL CHECK (played > 0),
  driver_credit NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount        NUMERIC(10,2) NOT NULL,  -- net charge, any sign
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, player_id),
  CONSTRAINT tfc_player_same_tournament FOREIGN KEY (tournament_id, player_id)
    REFERENCES tournament_players (tournament_id, id)
);

-- ---------- Derived views ----------

-- Fourth leg: settlement charges. The legacy match-fee leg stays —
-- pre-model rows keep counting until their matches are re-saved.
CREATE OR REPLACE VIEW tournament_player_balances AS
SELECT
  tp.id,
  COALESCE(d.total, 0) - COALESCE(e.total, 0) - COALESCE(m.total, 0)
    - COALESCE(c.total, 0) AS balance
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

-- Statement: add the settlement branch (same column list as
-- migration-22's version — OR REPLACE legal).
CREATE OR REPLACE VIEW tournament_player_statement AS
SELECT unified.player_id, unified.entry_date, unified.kind,
       unified.description, unified.delta,
  SUM(unified.delta) OVER (PARTITION BY unified.player_id
                           ORDER BY unified.entry_date, unified.created_at,
                                    unified.source_id
                           ROWS UNBOUNDED PRECEDING) AS running_balance,
  unified.created_at, unified.source_id,
  unified.match_id,
  a.name AS edited_by
FROM (
  SELECT te.player_id, te.entry_date, te.created_at,
         'deposit'::text AS kind, te.message AS description,
         te.amount AS delta, te.id AS source_id,
         NULL::uuid AS match_id,
         COALESCE(te.updated_by, te.created_by) AS editor_id
  FROM tournament_entries te
  WHERE te.kind = 'deposit'
  UNION ALL
  SELECT ts.player_id, te.entry_date, te.created_at,
         'expense_share'::text, te.message, -ts.amount, ts.id,
         NULL::uuid,
         COALESCE(te.updated_by, te.created_by)
  FROM tournament_expense_shares ts
  JOIN tournament_entries te ON te.id = ts.entry_id
  UNION ALL
  SELECT tmp.player_id, tm.match_date, tm.created_at,
         CASE WHEN tmp.fee_amount < 0 THEN 'driver_rebate'
              ELSE 'match_fee' END,
         'vs ' || tm.opponent, -tmp.fee_amount, tmp.id,
         tm.id,
         COALESCE(tm.updated_by, tm.created_by)
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
         NULL::uuid
  FROM tournament_fee_charges tfc
) unified
LEFT JOIN admins a ON a.id = unified.editor_id;

-- ---------- RLS ----------

ALTER TABLE tournament_fee_charges ENABLE ROW LEVEL SECURITY;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
