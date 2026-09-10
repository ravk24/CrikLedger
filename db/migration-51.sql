-- ============================================================
-- Migration 51: team grounds with a per-car allowance (reintroduced)
--
-- Migration 26 created team_grounds; migration 35 dropped it because
-- there was no admin screen and every new team would have needed
-- hand-written SQL (CrikLedger-docs/dropped-home_match-feature.md §7:
-- "build the admin UI first"). This time the table ships with:
--
--   * /admin/grounds — the team superadmin adds, edits, hides and
--     removes grounds and their per-car allowance;
--   * a picker on the scheduling forms (the venue stays free text on
--     matches — "Other ground…" still types a name);
--   * a car-fee prefill in the completion wizard, matched by name.
--
-- Presets move prefills only. A completed match keeps snapshotting the
-- confirmed figure in matches.car_allowance_per_car, so editing or
-- deleting a ground never touches history. No seed: each team fills
-- its own list. No FK from matches: matches.venue remains free text.
--
-- Names are unique per team case-insensitively ("Barne" = "barne").
-- Posture as migration 47: base table locked to anon/authenticated,
-- the *_public view runs as the invoker, service role reads it.
-- ============================================================

BEGIN;

CREATE TABLE team_grounds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  car_allowance NUMERIC(10,2) NOT NULL CHECK (car_allowance >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES admins(id),
  updated_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX team_grounds_team_name_key
  ON team_grounds (team_id, lower(btrim(name)));

ALTER TABLE team_grounds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON team_grounds FROM anon, authenticated;

CREATE VIEW team_grounds_public WITH (security_invoker = true) AS
  SELECT team_id, id, name, car_allowance, is_active
    FROM team_grounds;

REVOKE ALL ON team_grounds_public FROM anon, authenticated;

COMMIT;
