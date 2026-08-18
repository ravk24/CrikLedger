-- ============================================================
-- LR-SuperGiants v2 — Migration 25: per-match tournament fee
--
-- Replaces the global per-slot rate (migration-23) with a
-- per-match pot (Ravi 2026-08-17): costPerMatch = joining_fee
-- divided by the COMPLETED-match count at settlement, kept
-- fractional; matchPot = costPerMatch + cars × that match's
-- allowance; per-player share = CEIL(matchPot / attendees) —
-- the only rounding, always favoring the fund. Drivers still
-- get the allowance back per match driven.
--
-- Each match now has its own rate, so the drill-down can no
-- longer recover a single perSlot from the charge totals —
-- settlement persists one line per (player, match) instead.
-- ============================================================

-- Written by settleTournamentFees alongside tournament_fee_charges;
-- the parent-charge FK cascades, so reverseSettlement's charge
-- delete (and deleteTournament's) removes the lines too.
CREATE TABLE tournament_fee_charge_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL,
  player_id     UUID NOT NULL,
  match_id      UUID NOT NULL REFERENCES tournament_matches (id) ON DELETE CASCADE,
  share         NUMERIC(10,2) NOT NULL CHECK (share >= 0),
  driver_credit NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (driver_credit >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, player_id, match_id),
  CONSTRAINT tfcl_parent_charge FOREIGN KEY (tournament_id, player_id)
    REFERENCES tournament_fee_charges (tournament_id, player_id)
    ON DELETE CASCADE
);

ALTER TABLE tournament_fee_charge_lines ENABLE ROW LEVEL SECURITY;

-- The drill-down now reads PERSISTED settlement lines (authoritative
-- even if matches are later edited) instead of live participant rows.
-- Column set changes → DROP + CREATE, then re-grant.
-- Tournaments settled before this migration have charges but no
-- lines; the UI renders a totals-only fallback until re-settled.
DROP VIEW tournament_fee_breakdown_public;
CREATE VIEW tournament_fee_breakdown_public AS
SELECT l.tournament_id,
       l.player_id,
       l.match_id,
       tm.match_date,
       tm.match_time,
       tm.opponent,
       l.share,
       l.driver_credit
FROM tournament_fee_charge_lines l
JOIN tournament_matches tm ON tm.id = l.match_id;

GRANT SELECT ON tournament_fee_breakdown_public TO anon;

-- PostgREST caches the schema; changes 404 until reload.
NOTIFY pgrst, 'reload schema';
