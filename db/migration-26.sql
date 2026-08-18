-- ============================================================
-- CricLedger — Migration 26: teams + per-team settings tables
--
-- Feature 2 (tenancy) foundation, per the 2026-08-18 spec
-- (Project Details/cric_ledger/tenancy-schema.md). One app, many
-- teams: identity + settings live on `teams`; the hardcoded
-- GROUNDS / GROUND_SLOTS code literals get schema homes
-- (team_grounds, team_seasons, team_slots). Slot availability
-- stays DERIVED — a slot is open until any match exists on that
-- date — so there is no is_booked column to drift.
--
-- Seeds team #1 ('our-xi') plus its grounds/season/slots copied
-- verbatim from lib/grounds.ts and lib/groundSlots.ts: migration-27
-- backfills every existing row to this team before going NOT NULL,
-- and a future SG-prod import walks the same path.
--
-- teams.is_sandbox is the Feature-3 hook (sample teams); the
-- payments/entitlements tables ship with Feature 3, not here.
-- No enum changes — runs as ONE transaction.
-- ============================================================

CREATE TABLE teams (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  display_name          TEXT NOT NULL,
  short_name            TEXT,
  home_ground_name      TEXT,          -- matches a team_grounds.name (e.g. 'Barne, Pusane')
  home_ground_label     TEXT,          -- UI label (e.g. 'Barne'); feeds the later home/away rename
  meeting_point         TEXT,          -- carFee distance origin (e.g. 'Avval Chaha')
  status_threshold      NUMERIC(10,2) NOT NULL DEFAULT 900,  -- replaces the 900 literal in players_public
  car_rate_per_km       NUMERIC(6,2)  NOT NULL DEFAULT 9.6,  -- replaces engine/carFee.ts CAR_RATE_PER_KM
  brand_primary_color   TEXT,
  brand_secondary_color TEXT,
  logo_ref              TEXT,          -- storage key / URL; no FK
  is_sandbox            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-team ground list with the fixed per-car allowance (whole
-- rupees). Completed matches still snapshot the confirmed value in
-- matches.car_allowance_per_car — edits here only move prefills.
CREATE TABLE team_grounds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  car_allowance NUMERIC(10,2) NOT NULL CHECK (car_allowance >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, name),
  UNIQUE (team_id, id)   -- composite-FK target (future use)
);

CREATE TABLE team_seasons (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,                     -- e.g. 'Season 2'
  starts_on  DATE NOT NULL,
  ends_on    DATE NOT NULL CHECK (ends_on >= starts_on),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, label),
  UNIQUE (team_id, id)   -- composite-FK target for team_slots
);

-- One bookable date per row. team_id is stored so the composite FK
-- chains a slot to a season OF THE SAME TEAM, structurally
-- (the tournament_match_participants.tournament_id precedent).
CREATE TABLE team_slots (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL,
  season_id  UUID NOT NULL,
  slot_date  DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, slot_date),
  CONSTRAINT ts_season_same_team FOREIGN KEY (team_id, season_id)
    REFERENCES team_seasons (team_id, id) ON DELETE CASCADE
);

-- ---------- RLS + grants (m1 posture: base locked, views readable) ----------

ALTER TABLE teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_grounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_slots   ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON teams, team_grounds, team_seasons, team_slots FROM anon;

-- ---------- Seed team #1 (backfill target for migration-27) ----------

INSERT INTO teams (slug, display_name, short_name,
                   home_ground_name, home_ground_label, meeting_point)
VALUES ('our-xi', 'Our XI', 'Our XI', 'Barne, Pusane', 'Barne', 'Avval Chaha');

-- 16 grounds, verbatim from lib/grounds.ts (sort_order = list position).
INSERT INTO team_grounds (team_id, name, car_allowance, sort_order)
SELECT t.id, g.name, g.allowance, g.ord
FROM teams t,
     (VALUES
        ('Barne, Pusane',                    250,  0),
        ('Vedhant, Parandwadi',              283,  1),
        ('Spark A1/A2',                       87,  2),
        ('Cric Haven',                       102,  3),
        ('DY Patil, Salumbre',               150,  4),
        ('Chrysallis',                       133,  5),
        ('Gripx, Ravet',                     156,  6),
        ('VDR, Ganhunje',                    270,  7),
        ('Sachin Ghotkule/ Gurukul, Adale',  273,  8),
        ('CSMCC',                            127,  9),
        ('30YCA, Chandkhed',                 148, 10),
        ('Changbhale',                       226, 11),
        ('Triple Crown',                      77, 12),
        ('MCG',                               50, 13),
        ('Lords, Mawal',                     156, 14),
        ('Lords, Mulshi',                     66, 15)
     ) AS g(name, allowance, ord)
WHERE t.slug = 'our-xi';

INSERT INTO team_seasons (team_id, label, starts_on, ends_on)
SELECT t.id, 'Season 2', DATE '2026-11-01', DATE '2027-05-30'
FROM teams t WHERE t.slug = 'our-xi';

-- 61 Season-2 slots, verbatim from lib/groundSlots.ts
-- (every Sat + Sun, 1 Nov 2026 – 30 May 2027).
INSERT INTO team_slots (team_id, season_id, slot_date)
SELECT s.team_id, s.id, d.slot_date
FROM team_seasons s
JOIN teams t ON t.id = s.team_id AND t.slug = 'our-xi'
CROSS JOIN unnest(ARRAY[
  '2026-11-01','2026-11-07','2026-11-08','2026-11-14','2026-11-15',
  '2026-11-21','2026-11-22','2026-11-28','2026-11-29',
  '2026-12-05','2026-12-06','2026-12-12','2026-12-13','2026-12-19',
  '2026-12-20','2026-12-26','2026-12-27',
  '2027-01-02','2027-01-03','2027-01-09','2027-01-10','2027-01-16',
  '2027-01-17','2027-01-23','2027-01-24','2027-01-30','2027-01-31',
  '2027-02-06','2027-02-07','2027-02-13','2027-02-14','2027-02-20',
  '2027-02-21','2027-02-27','2027-02-28',
  '2027-03-06','2027-03-07','2027-03-13','2027-03-14','2027-03-20',
  '2027-03-21','2027-03-27','2027-03-28',
  '2027-04-03','2027-04-04','2027-04-10','2027-04-11','2027-04-17',
  '2027-04-18','2027-04-24','2027-04-25',
  '2027-05-01','2027-05-02','2027-05-08','2027-05-09','2027-05-15',
  '2027-05-16','2027-05-22','2027-05-23','2027-05-29','2027-05-30'
]::date[]) AS d(slot_date)
WHERE s.label = 'Season 2';

-- ---------- Public views (definer, same posture as every *_public) ----------

CREATE VIEW teams_public AS
SELECT id, slug, display_name, short_name, home_ground_name, home_ground_label,
       meeting_point, status_threshold, car_rate_per_km,
       brand_primary_color, brand_secondary_color, logo_ref, is_sandbox, created_at
FROM teams;

CREATE VIEW team_grounds_public AS
SELECT team_id, id, name, car_allowance, is_active, sort_order
FROM team_grounds;

CREATE VIEW team_slots_public AS
SELECT s.team_id, s.slot_date,
       se.label AS season_label, se.starts_on, se.ends_on
FROM team_slots s
JOIN team_seasons se ON se.id = s.season_id;

GRANT SELECT ON teams_public, team_grounds_public, team_slots_public TO anon;

-- PostgREST caches the schema; new views 404 until reload.
NOTIFY pgrst, 'reload schema';
