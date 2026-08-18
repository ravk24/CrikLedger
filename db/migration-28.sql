-- ============================================================
-- CricLedger — Migration 28: composite FKs (structural isolation)
--
-- Every FK between team-scoped tables becomes (team_id, X) →
-- parent (team_id, id), so a cross-team reference is a constraint
-- violation, not a code-review hope — exactly the tournament
-- pattern (t_entry_player_same_tournament & co, migrations 19/22).
-- Referential actions are preserved from the originals:
--   CASCADE  = child rows die with the parent (match fee rows, splits)
--   NO ACTION = history guard (blocks deleting a player with rows)
--   SET NULL = hand-deleting a ledger row just unlinks it; the
--     PG15+ column-list form SET NULL (col) nulls ONLY the id
--     column, so team_id survives the unlink (dev DB is PG 17).
--
-- The single-column UNIQUEs (pool_entries.match_id — the
-- one-collection-per-match ON CONFLICT target — recovery_of,
-- matches.other_fee_entry_id, both booking entry links) are separate
-- constraints and stay untouched; their semantics don't change.
--
-- NOTE: the dropped FK names are Postgres defaults, verified on the
-- dev DB 2026-08-18 via
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = '<table>'::regclass AND contype = 'f';
-- re-verify before applying elsewhere.
-- ============================================================

-- ---------- match_participants ----------

ALTER TABLE match_participants DROP CONSTRAINT match_participants_match_id_fkey;
ALTER TABLE match_participants ADD CONSTRAINT mp_match_same_team
  FOREIGN KEY (team_id, match_id) REFERENCES matches (team_id, id)
  ON DELETE CASCADE;

ALTER TABLE match_participants DROP CONSTRAINT match_participants_player_id_fkey;
ALTER TABLE match_participants ADD CONSTRAINT mp_player_same_team
  FOREIGN KEY (team_id, player_id) REFERENCES players (team_id, id);

-- ---------- pool_entries ----------

ALTER TABLE pool_entries DROP CONSTRAINT pool_entries_player_id_fkey;
ALTER TABLE pool_entries ADD CONSTRAINT pe_player_same_team
  FOREIGN KEY (team_id, player_id) REFERENCES players (team_id, id);

ALTER TABLE pool_entries DROP CONSTRAINT pool_entries_match_id_fkey;
ALTER TABLE pool_entries ADD CONSTRAINT pe_match_same_team
  FOREIGN KEY (team_id, match_id) REFERENCES matches (team_id, id)
  ON DELETE CASCADE;

ALTER TABLE pool_entries DROP CONSTRAINT pool_entries_recovery_of_fkey;
ALTER TABLE pool_entries ADD CONSTRAINT pe_recovery_same_team
  FOREIGN KEY (team_id, recovery_of) REFERENCES pool_entries (team_id, id)
  ON DELETE CASCADE;

-- ---------- expense_shares ----------

ALTER TABLE expense_shares DROP CONSTRAINT expense_shares_pool_entry_id_fkey;
ALTER TABLE expense_shares ADD CONSTRAINT es_entry_same_team
  FOREIGN KEY (team_id, pool_entry_id) REFERENCES pool_entries (team_id, id)
  ON DELETE CASCADE;

ALTER TABLE expense_shares DROP CONSTRAINT expense_shares_player_id_fkey;
ALTER TABLE expense_shares ADD CONSTRAINT es_player_same_team
  FOREIGN KEY (team_id, player_id) REFERENCES players (team_id, id);

-- ---------- ground_bookings ↔ pool_entries ----------

ALTER TABLE ground_bookings DROP CONSTRAINT ground_bookings_pool_entry_id_fkey;
ALTER TABLE ground_bookings ADD CONSTRAINT gb_entry_same_team
  FOREIGN KEY (team_id, pool_entry_id) REFERENCES pool_entries (team_id, id)
  ON DELETE SET NULL (pool_entry_id);

ALTER TABLE ground_bookings DROP CONSTRAINT ground_bookings_pending_cleared_entry_id_fkey;
ALTER TABLE ground_bookings ADD CONSTRAINT gb_pending_entry_same_team
  FOREIGN KEY (team_id, pending_cleared_entry_id) REFERENCES pool_entries (team_id, id)
  ON DELETE SET NULL (pending_cleared_entry_id);

-- ---------- matches → booking / other-fee entry ----------

ALTER TABLE matches DROP CONSTRAINT matches_ground_booking_id_fkey;
ALTER TABLE matches ADD CONSTRAINT m_booking_same_team
  FOREIGN KEY (team_id, ground_booking_id) REFERENCES ground_bookings (team_id, id)
  ON DELETE SET NULL (ground_booking_id);

ALTER TABLE matches DROP CONSTRAINT matches_other_fee_entry_id_fkey;
ALTER TABLE matches ADD CONSTRAINT m_other_fee_entry_same_team
  FOREIGN KEY (team_id, other_fee_entry_id) REFERENCES pool_entries (team_id, id)
  ON DELETE SET NULL (other_fee_entry_id);

-- No view/schema-cache changes in this file.
