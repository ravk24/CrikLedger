-- ============================================================
-- CricLedger — Migration 36: one scheduling structure
--
-- Scheduling drops the inherited two-step shape (a mandatory
-- "paid to opponent/owner" choice, a mandatory opponent, and a
-- fee that could only ever be a pool debit) for one flat form.
-- Two states the team actually has become expressible:
--
--   * a date on the calendar with no opponent yet  -> opponent NULL
--   * a fee that came INTO the pool                -> fee_direction
--
-- The match card reads these back as a coloured dot: red = no
-- opponent, orange = opponent with fee_pending > 0, green =
-- opponent and fully paid.
--
-- fee_paid_to is deliberately LEFT IN PLACE holding its legacy
-- values; nothing new writes it. Dropping it would rewrite
-- matches_public for no gain.
--
-- Runs AFTER migration 35 — the view body below is the one 35
-- leaves behind, plus the two new columns. CREATE OR REPLACE is
-- legal here (unlike 35) because the columns are APPENDED and no
-- existing column changes name, type or position.
--
-- Runs as ONE transaction. No enum changes: a 'credit' fee reuses
-- the existing other_income kind precisely so ALTER TYPE ...
-- ADD VALUE stays out of this file (it cannot share a transaction
-- with statements that use the new value — see migrations 4 and 8,
-- which db/apply-migrations.mjs has to special-case).
-- ============================================================

BEGIN;

-- ---------- 1. The red-dot state ----------
-- A match may now be put on the calendar before an opponent is
-- known. Existing rows all have a name and are unaffected.
ALTER TABLE matches ALTER COLUMN opponent DROP NOT NULL;

-- ---------- 2. Match fee: direction and what is outstanding ----------
-- fee_direction says which way the money moved, which is what
-- decides whether completion RECOUPS it: a debit was fronted by the
-- pool and is recouped from player fees; a credit never was, and
-- recouping it would credit the pool twice for the same money.
-- NULL = no fee recorded (the master switch was left off).
--
-- fee_pending is the still-outstanding slice of the fee. The pool
-- entry is written for (fee - fee_pending); clearing the remainder
-- writes a second entry in the same direction.
ALTER TABLE matches
  ADD COLUMN fee_direction TEXT CHECK (fee_direction IN ('credit', 'debit')),
  ADD COLUMN fee_pending   NUMERIC(10,2) NOT NULL DEFAULT 0
    CHECK (fee_pending >= 0);

-- ---------- 3. Expose both to the public view ----------
-- Append-only, so OR REPLACE is legal. The card needs fee_pending
-- for the dot; fee_direction rides along for the fee panels.
CREATE OR REPLACE VIEW matches_public AS
SELECT m.id, m.match_date, m.opponent, m.status, m.result,
       m.abandoned_reason, m.ground_fee, m.ball_fee, m.other_fee,
       m.car_allowance_per_car, m.created_at, m.updated_at,
       a.name AS updated_by_name,
       m.guest_names,
       m.guest_cars,
       m.venue,
       m.fee_paid_to,
       m.team_id,
       m.ground_booking_id,
       m.guest_shared_cars,
       m.fee_direction,
       m.fee_pending
FROM matches m
LEFT JOIN admins a ON a.id = COALESCE(m.updated_by, m.created_by);

COMMIT;

-- PostgREST caches the schema; new columns 404 until reload.
NOTIFY pgrst, 'reload schema';
