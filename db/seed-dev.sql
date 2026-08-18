-- ============================================================
-- CricLedger — Development seed
-- Test players + a few pool entries so the public pages have data.
-- Do NOT run in production. Players are name-only (migration 5).
-- Tenancy (migration 26+): every row belongs to the default team
-- seeded by migration-26 (slug 'our-xi').
-- ============================================================

INSERT INTO players (name, team_id)
SELECT p.name, t.id
FROM teams t,
     (VALUES ('Ramesh K.'), ('Priya S.'), ('Imran Q.'),
             ('Sunil D.'), ('Vikram T.')) AS p(name)
WHERE t.slug = 'our-xi';

-- Deposits: credit the pool AND the named player
INSERT INTO pool_entries (entry_date, kind, message, amount, player_id, team_id)
SELECT '2026-07-01', 'deposit', 'Season-2 opening deposit', 500, id, team_id
FROM players WHERE name = 'Ramesh K.';

INSERT INTO pool_entries (entry_date, kind, message, amount, player_id, team_id)
SELECT '2026-07-01', 'deposit', 'Season-2 opening deposit', 500, id, team_id
FROM players WHERE name = 'Priya S.';

INSERT INTO pool_entries (entry_date, kind, message, amount, player_id, team_id)
SELECT '2026-07-03', 'deposit', 'Opening deposit', 300, id, team_id
FROM players WHERE name = 'Imran Q.';

-- One plain debit so the ledger shows both signs
INSERT INTO pool_entries (entry_date, kind, message, amount, team_id)
SELECT '2026-07-05', 'plain_debit', 'Ground advance — Vasai', -400, t.id
FROM teams t WHERE t.slug = 'our-xi';
