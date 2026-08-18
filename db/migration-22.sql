-- ============================================================
-- LR-SuperGiants v2 — Migration 22: Tournament matches
--
-- The SG match engine, scoped to a tournament's isolated roster
-- and ledger. NO guests (teams declare players publicly before
-- participating) — so no guest columns, no captain-charge rows.
-- Money mirrors SG: player fees charge tournament balances; the
-- rounding surplus (collected − cash costs) is the ONLY automatic
-- fund credit ('match_collection', one per match via UNIQUE
-- match_id upsert, deleted when edits push it ≤ 0).
-- match_time is NOT NULL — tournaments run all day in slots, the
-- time is the most important scheduling field (Ravi).
--
-- NOTE: verify the auto-generated name of the tournament_entries
-- kind CHECK before running (declared inline in migration-19, so
-- Postgres named it tournament_entries_kind_check; confirm with
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'tournament_entries'::regclass;
-- and adjust the DROP below if it differs).
-- ============================================================

CREATE TABLE tournament_matches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id         UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_date            DATE NOT NULL,
  match_time            TIME NOT NULL,
  opponent              TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','completed','abandoned')),
  result                TEXT CHECK (result IN ('won','lost')),
  abandoned_reason      TEXT,
  ground_fee            NUMERIC(10,2) NOT NULL DEFAULT 0,
  ball_fee              NUMERIC(10,2) NOT NULL DEFAULT 0,
  other_fee             NUMERIC(10,2) NOT NULL DEFAULT 0,
  car_allowance_per_car NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_by            UUID REFERENCES admins(id),
  updated_by            UUID REFERENCES admins(id),
  updated_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT t_completed_has_result
    CHECK (status <> 'completed' OR result IS NOT NULL),
  CONSTRAINT t_abandoned_has_reason
    CHECK (status <> 'abandoned' OR abandoned_reason IS NOT NULL),
  UNIQUE (tournament_id, id)   -- composite-FK target
);
-- No guest columns; the venue lives on the tournament, not the match.

-- Fee rows, replaced wholesale on every complete/edit. tournament_id
-- is stored here so BOTH composite FKs share it — a participant can
-- never join a match and a player from different tournaments, purely
-- at the DB level. The NO ACTION player FK also blocks hard-deleting
-- a player who has match history.
CREATE TABLE tournament_match_participants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL,
  match_id      UUID NOT NULL,
  player_id     UUID NOT NULL,
  brought_car   BOOLEAN NOT NULL DEFAULT FALSE,
  fee_amount    NUMERIC(10,2) NOT NULL,
  UNIQUE (match_id, player_id),
  CONSTRAINT tmp_match_same_tournament FOREIGN KEY (tournament_id, match_id)
    REFERENCES tournament_matches (tournament_id, id) ON DELETE CASCADE,
  CONSTRAINT tmp_player_same_tournament FOREIGN KEY (tournament_id, player_id)
    REFERENCES tournament_players (tournament_id, id)
);

-- ---------- Ledger: new kind + match link (constraint swaps) ----------

ALTER TABLE tournament_entries DROP CONSTRAINT tournament_entries_kind_check;
ALTER TABLE tournament_entries ADD CONSTRAINT tournament_entries_kind_check
  CHECK (kind IN ('deposit','common_debit','match_collection'));

ALTER TABLE tournament_entries DROP CONSTRAINT t_sign_matches_kind;
ALTER TABLE tournament_entries ADD CONSTRAINT t_sign_matches_kind CHECK (
  (kind IN ('deposit','match_collection') AND amount > 0) OR
  (kind = 'common_debit' AND amount < 0)
);

-- UNIQUE is load-bearing: it powers the ON CONFLICT (match_id) upsert
-- (one collection per match — the pool_entries.match_id precedent).
ALTER TABLE tournament_entries ADD COLUMN match_id UUID UNIQUE;
ALTER TABLE tournament_entries ADD CONSTRAINT t_entry_match_same_tournament
  FOREIGN KEY (tournament_id, match_id)
  REFERENCES tournament_matches (tournament_id, id) ON DELETE CASCADE;
ALTER TABLE tournament_entries ADD CONSTRAINT t_collection_has_match
  CHECK (kind <> 'match_collection' OR match_id IS NOT NULL);

-- ---------- Derived views ----------

-- Third leg: match fees. Same column list -> OR REPLACE legal.
CREATE OR REPLACE VIEW tournament_player_balances AS
SELECT
  tp.id,
  COALESCE(d.total, 0) - COALESCE(e.total, 0) - COALESCE(m.total, 0) AS balance
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
           GROUP BY player_id) m ON m.player_id = tp.id;

-- Statement: add the match branch; existing 8 columns keep their order,
-- match_id + edited_by are APPENDED (OR REPLACE is append-only).
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
) unified
LEFT JOIN admins a ON a.id = unified.editor_id;

-- Match cards/detail, matches_public shape.
CREATE VIEW tournament_matches_public AS
SELECT tm.id, tm.tournament_id, tm.match_date, tm.match_time, tm.opponent,
       tm.status, tm.result, tm.abandoned_reason, tm.ground_fee, tm.ball_fee,
       tm.other_fee, tm.car_allowance_per_car, tm.created_at, tm.updated_at,
       a.name AS updated_by_name
FROM tournament_matches tm
LEFT JOIN admins a ON a.id = COALESCE(tm.updated_by, tm.created_by);

-- Literal TRUE/0 keep the MatchParticipantPublic shape so the SG
-- FeeTable renders unchanged (no guests => no charge-only rows).
CREATE VIEW tournament_match_participants_public AS
SELECT tmp.match_id, tmp.tournament_id, tp.name AS player_name,
       tmp.brought_car, tmp.fee_amount, tp.is_captain,
       TRUE AS is_playing, 0::numeric AS guest_fee_share
FROM tournament_match_participants tmp
JOIN tournament_players tp ON tp.id = tmp.player_id;

-- ---------- RLS + grants ----------

ALTER TABLE tournament_matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_match_participants ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON tournament_matches_public,
               tournament_match_participants_public TO anon;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
