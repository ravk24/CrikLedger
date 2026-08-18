-- ============================================================
-- LR-SuperGiants v1 — Migration 5: remove phone numbers
--
-- Player logins never shipped (auth = admin username/password),
-- so phone_number was contact-only PII with no functional role.
-- Removing it eliminates the risk of holding real numbers.
-- Player uniqueness moves to the name (admins disambiguate with
-- a surname/initial when needed).
-- ============================================================

-- players_public selects phone_number, so it must be dropped and
-- recreated (a view cannot lose a column in place). Grants die
-- with the DROP — re-grant below.
DROP VIEW players_public;

ALTER TABLE players DROP COLUMN phone_number;
ALTER TABLE players ADD CONSTRAINT players_name_key UNIQUE (name);

-- Same definition as migration-1, minus phone_masked.
CREATE VIEW players_public AS
SELECT
  p.id,
  p.name,
  p.is_active,
  b.balance,
  CASE
    WHEN NOT p.is_active   THEN 'inactive'
    WHEN b.balance > 200   THEN 'surplus'   -- green
    WHEN b.balance >= 0    THEN 'low'       -- orange
    ELSE                        'debt'      -- red
  END AS status
FROM players p JOIN player_balances b ON b.id = p.id;

GRANT SELECT ON players_public TO anon;

-- PostgREST caches the schema; the recreated view 404s until reload.
NOTIFY pgrst, 'reload schema';
