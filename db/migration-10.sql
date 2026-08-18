-- ============================================================
-- LR-SuperGiants v2 — Migration 10: vice-captain role +
-- public ground-booking summary
--
-- One standing vice-captain (superadmin-declared), mirroring the
-- captain from migration-7 but with no financial role — purely a
-- displayed title. A player can never hold both roles.
--
-- ground_bookings_public exposes the booking team's captain and
-- pending amount so the public matches page can show payment
-- status for matches created from ground bookings (matched by
-- matches.opponent = ground_bookings.team_name). amount_paid,
-- slots and pool_entry_id stay admin-only.
-- ============================================================

ALTER TABLE players ADD COLUMN is_vice_captain BOOLEAN NOT NULL DEFAULT FALSE;

-- At most one vice-captain, enforced by the database.
CREATE UNIQUE INDEX players_one_vice_captain
  ON players (is_vice_captain) WHERE is_vice_captain;

-- Captain and vice-captain are always different people.
ALTER TABLE players ADD CONSTRAINT captain_is_not_vice_captain
  CHECK (NOT (is_captain AND is_vice_captain));

-- ---- Views (append-only -> OR REPLACE legal, grants survive) ----

CREATE OR REPLACE VIEW players_public AS
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
  END AS status,
  p.is_captain,
  p.is_vice_captain
FROM players p JOIN player_balances b ON b.id = p.id;

-- Public booking summary. created_at lets the client pick the
-- LATEST booking when a team has booked more than once. The view
-- runs with owner privileges — same posture as every *_public
-- view over an RLS-locked base table.
CREATE VIEW ground_bookings_public AS
SELECT gb.team_name, gb.captain, gb.amount_pending, gb.created_at
FROM ground_bookings gb;

GRANT SELECT ON ground_bookings_public TO anon;

-- PostgREST caches the schema; new columns/views 404 until reload.
NOTIFY pgrst, 'reload schema';
