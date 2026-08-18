-- ============================================================
-- CricLedger — Migration 33: close the anon read surface
--
-- Feature 4 (auth) M3. This is the change that makes "a paid team's
-- ledger requires a session" TRUE rather than cosmetic.
--
-- The hole: the *_public views run as their owner, so they bypass the
-- RLS on the underlying tables — that is exactly why the app reads
-- through them. But NEXT_PUBLIC_SUPABASE_ANON_KEY ships inside the
-- browser bundle, so anyone could call PostgREST directly and read
-- every team's players, balances, statements and ledger, no matter what
-- the UI showed. Verified before writing this file: a plain curl with
-- the public key returned player names, individual debts and the pool
-- balance.
--
-- The fix is to take the views off the anon role entirely. Server
-- components now read them with the service role
-- (lib/supabase-server.ts), which is never sent to the browser.
--
-- Consequence to keep in mind: the service role bypasses RLS, so every
-- read must still filter by team in application code (lib/team.ts).
-- The database is not a second line of defence here — true row-level
-- enforcement is Feature 7's RLS work.
--
-- Base tables are also revoked below. Those grants are Supabase's
-- default GRANT on the public schema and are currently harmless (every
-- base table has RLS enabled with zero policies, so anon selects
-- nothing), but leaving a live grant behind an RLS toggle is a trap for
-- whoever next adds a policy.
--
-- Runs as ONE transaction. Deletes nothing, changes no data.
-- ============================================================

BEGIN;

-- ---------- 1. Views: the actual leak ----------
REVOKE SELECT ON
  teams_public,
  team_grounds_public,
  team_slots_public,
  players_public,
  player_balances,
  player_statement,
  matches_public,
  match_participants_public,
  ground_bookings_public,
  pool_balance,
  pool_ledger_public,
  tournaments_public,
  tournament_players_public,
  tournament_player_balances,
  tournament_player_statement,
  tournament_ledger_public,
  tournament_matches_public,
  tournament_match_participants_public,
  tournament_fee_charges_public,
  tournament_fee_breakdown_public
FROM anon;

-- ---------- 2. Vestigial base-table grants ----------
-- Defence in depth only; RLS already blocks these.
REVOKE ALL ON
  tournaments,
  tournament_players,
  tournament_matches,
  tournament_match_participants,
  tournament_entries,
  tournament_expense_shares,
  tournament_fee_charges,
  tournament_fee_charge_lines,
  ground_bookings
FROM anon;

-- The migration bookkeeping table has no business being public either.
REVOKE ALL ON _migrations FROM anon;

-- ---------- 3. Stop the default grant re-arming ----------
-- Supabase's default privileges hand anon SELECT on anything created
-- later in this schema, which would silently re-open the surface the
-- next time a view is added.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;

COMMIT;

-- PostgREST caches the schema; grant changes need a reload to take.
NOTIFY pgrst, 'reload schema';
