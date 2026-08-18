-- ============================================================
-- LR-SuperGiants v2 — Migration 19: Tournaments (ledger-only)
--
-- Per-tournament balance sheets, FULLY ISOLATED from SuperGiants
-- data and from each other: every tournament has its own typed-name
-- roster (no link to players — the same human gets a fresh row and
-- a fresh balance) and its own signed ledger. Money ops: deposits
-- per player, common expenses split across the CURRENT active
-- roster (splits freeze at entry time — late joiners owe nothing;
-- editing an expense re-splits, same rule as the pool common
-- debit). Balances and the fund total are derived by views — no
-- stored balances anywhere (core invariant).
--
-- status/kind are TEXT + CHECK (not enums) so this migration runs
-- as ONE transaction and future kinds are a constraint swap, not
-- an ALTER TYPE dance (see migration-4's autocommit warning).
-- ============================================================

CREATE TABLE tournaments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT UNIQUE NOT NULL,
  season_label TEXT,                        -- optional, e.g. "Winter 2026"
  start_date   DATE,
  end_date     DATE,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','completed')),
  created_by   UUID REFERENCES admins(id),
  updated_by   UUID REFERENCES admins(id),
  updated_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Typed-name roster. is_active = FALSE means removed-with-history
-- (players with ledger rows are never hard-deleted; rowless typo
-- entries are). UNIQUE (tournament_id, id) exists purely as the
-- target of the composite FK below.
CREATE TABLE tournament_players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, name),
  UNIQUE (tournament_id, id)
);

-- Signed ledger, pool_entries style: positive = credit (deposit),
-- negative = debit (common expense). message may be '' for deposits
-- (the ledger titles them by player name).
CREATE TABLE tournament_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  kind          TEXT NOT NULL CHECK (kind IN ('deposit','common_debit')),
  message       TEXT NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,
  player_id     UUID,
  created_by    UUID REFERENCES admins(id),
  updated_by    UUID REFERENCES admins(id),
  updated_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT t_sign_matches_kind CHECK (
    (kind = 'deposit'      AND amount > 0) OR
    (kind = 'common_debit' AND amount < 0)
  ),
  CONSTRAINT t_deposit_has_player CHECK (kind <> 'deposit' OR player_id IS NOT NULL),
  -- DB-level isolation: the linked player MUST belong to the SAME
  -- tournament — a deposit can never point at another tournament's
  -- player. Default NO ACTION also blocks deleting a player who
  -- still has deposit rows.
  CONSTRAINT t_entry_player_same_tournament
    FOREIGN KEY (tournament_id, player_id)
    REFERENCES tournament_players (tournament_id, id)
);

-- Frozen split rows (expense_shares style). Written once per active
-- player when a common expense is recorded; replaced wholesale when
-- the expense is edited (re-split against the then-current roster).
CREATE TABLE tournament_expense_shares (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id  UUID NOT NULL REFERENCES tournament_entries(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES tournament_players(id) ON DELETE CASCADE,
  amount    NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  UNIQUE (entry_id, player_id)
);

-- ---------- Derived views (no stored balances, ever) ----------

-- Internal building block (NOT anon-granted): balance = own deposits
-- minus own expense shares. Same shape as player_balances.
CREATE VIEW tournament_player_balances AS
SELECT
  tp.id,
  COALESCE(d.total, 0) - COALESCE(e.total, 0) AS balance
FROM tournament_players tp
LEFT JOIN (SELECT player_id, SUM(amount) AS total
           FROM tournament_entries
           WHERE kind = 'deposit'
           GROUP BY player_id) d ON d.player_id = tp.id
LEFT JOIN (SELECT player_id, SUM(amount) AS total
           FROM tournament_expense_shares
           GROUP BY player_id) e ON e.player_id = tp.id;

-- Index cards + fund card: fund = plain signed sum of the ledger
-- (pool_balance rule), player_count counts the active roster.
CREATE VIEW tournaments_public AS
SELECT t.id, t.name, t.season_label, t.start_date, t.end_date, t.status,
       COALESCE(f.balance, 0) AS fund_balance,
       COALESCE(pc.count, 0)  AS player_count,
       t.created_at
FROM tournaments t
LEFT JOIN (SELECT tournament_id, SUM(amount) AS balance
           FROM tournament_entries
           GROUP BY tournament_id) f ON f.tournament_id = t.id
LEFT JOIN (SELECT tournament_id, COUNT(*) FILTER (WHERE is_active) AS count
           FROM tournament_players
           GROUP BY tournament_id) pc ON pc.tournament_id = t.id;

-- Roster with derived balance. No ₹900 threshold here — that rule is
-- SuperGiants-specific; tournaments only distinguish debt vs clear.
CREATE VIEW tournament_players_public AS
SELECT tp.id, tp.tournament_id, tp.name, tp.is_active, b.balance,
  CASE WHEN NOT tp.is_active THEN 'inactive'
       WHEN b.balance < 0    THEN 'debt'
       ELSE                       'clear' END AS status
FROM tournament_players tp
JOIN tournament_player_balances b ON b.id = tp.id;

-- Ledger rows, pool_ledger_public style: edited_by resolves the last
-- touching admin, player_name titles deposit rows.
CREATE VIEW tournament_ledger_public AS
SELECT te.id, te.tournament_id, te.entry_date, te.kind, te.message, te.amount,
       a.name  AS edited_by,
       tp.name AS player_name
FROM tournament_entries te
LEFT JOIN admins a ON a.id = COALESCE(te.updated_by, te.created_by)
LEFT JOIN tournament_players tp ON tp.id = te.player_id
ORDER BY te.entry_date DESC, te.created_at DESC;

-- Per-player statement with running balance (player_statement shape:
-- UNION ALL the money sources, window-sum the deltas).
CREATE VIEW tournament_player_statement AS
SELECT player_id, entry_date, kind, description, delta,
  SUM(delta) OVER (PARTITION BY player_id
                   ORDER BY entry_date, created_at, source_id
                   ROWS UNBOUNDED PRECEDING) AS running_balance,
  created_at, source_id
FROM (
  SELECT te.player_id, te.entry_date, te.created_at,
         'deposit'::text AS kind, te.message AS description,
         te.amount AS delta, te.id AS source_id
  FROM tournament_entries te
  WHERE te.kind = 'deposit'
  UNION ALL
  SELECT ts.player_id, te.entry_date, te.created_at,
         'expense_share'::text, te.message, -ts.amount, ts.id
  FROM tournament_expense_shares ts
  JOIN tournament_entries te ON te.id = ts.entry_id
) unified;

-- ---------- RLS + grants (base tables locked, anon reads views) ----------

ALTER TABLE tournaments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_players        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_expense_shares ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON tournaments_public, tournament_players_public,
               tournament_ledger_public, tournament_player_statement TO anon;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
