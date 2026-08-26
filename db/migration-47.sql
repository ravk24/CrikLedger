-- ============================================================
-- CricLedger — Migration 47: invoker-rights views, close the
-- authenticated role, RLS on _migrations
--
-- Prompted by the Supabase Security Advisor, which flagged every view
-- in the schema as "Security Definer View" and _migrations as "RLS
-- Disabled in Public".
--
-- What was actually exposed, verified on prod before writing this
-- (PostgreSQL 17.6, has_table_privilege + pg_roles):
--
--   role            bypassrls  SELECT views  SELECT tables  _migrations
--   service_role    yes        yes           yes            yes
--   anon            no         no            no             no
--   authenticated   no         YES           YES            YES
--
-- anon was closed by migration 33. authenticated never was: Supabase's
-- default grants still hand it SELECT on everything, and because the
-- views ran with owner rights they bypassed the deny-all RLS on the
-- base tables. The app never mints a Supabase-Auth JWT (auth is
-- entirely custom, lib/session.ts), but Supabase Auth is switched on
-- for every project by default and the anon key needed to call signUp
-- ships in the browser bundle. So a self-registered user could read
-- every team's ledger straight through PostgREST. That is the hole the
-- advisor is pointing at, even if it does not say so in those words.
--
-- The invariant that makes this safe for the app: service_role has
-- BYPASSRLS and SELECT on every base table, so switching the views to
-- invoker rights changes nothing for the server-side read path
-- (lib/supabase-server.ts). Writes run as postgres over the pooler
-- (lib/db.ts) — the owner, also BYPASSRLS. The views only stop working
-- for roles that were never supposed to read them.
--
-- ALTER VIEW ... SET keeps each definition and column list intact: no
-- DROP + CREATE, no dependency churn, no change to the tenant-key
-- pushdown from migrations 40/45 (the views were never
-- security_barrier, so the planner treats them the same either way).
--
-- Runs as ONE transaction. Deletes nothing, changes no data.
-- ============================================================

BEGIN;

-- ---------- 1. Views run as the caller, not the owner ----------
-- With this set, a SELECT on a view is subject to the RLS of the base
-- tables as seen by whoever is asking. For service_role that is a
-- no-op; for anyone else it is deny-all.
ALTER VIEW public.match_attendee_counts               SET (security_invoker = true);
ALTER VIEW public.match_participants_public           SET (security_invoker = true);
ALTER VIEW public.matches_public                      SET (security_invoker = true);
ALTER VIEW public.player_balances                     SET (security_invoker = true);
ALTER VIEW public.player_car_counts                   SET (security_invoker = true);
ALTER VIEW public.player_statement                    SET (security_invoker = true);
ALTER VIEW public.players_public                      SET (security_invoker = true);
ALTER VIEW public.pool_balance                        SET (security_invoker = true);
ALTER VIEW public.pool_ledger_public                  SET (security_invoker = true);
ALTER VIEW public.teams_public                        SET (security_invoker = true);
ALTER VIEW public.tournament_fee_breakdown_public     SET (security_invoker = true);
ALTER VIEW public.tournament_fee_charges_public       SET (security_invoker = true);
ALTER VIEW public.tournament_ledger_public            SET (security_invoker = true);
ALTER VIEW public.tournament_match_attendee_counts    SET (security_invoker = true);
ALTER VIEW public.tournament_match_participants_public SET (security_invoker = true);
ALTER VIEW public.tournament_matches_public           SET (security_invoker = true);
ALTER VIEW public.tournament_player_balances          SET (security_invoker = true);
ALTER VIEW public.tournament_player_statement         SET (security_invoker = true);
ALTER VIEW public.tournament_players_public           SET (security_invoker = true);
ALTER VIEW public.tournaments_public                  SET (security_invoker = true);

-- ---------- 2. The one table without RLS ----------
-- db/apply-migrations.mjs creates _migrations outside the migration
-- files, so it never got the ENABLE that every other table has. The
-- runner connects as postgres (owner + BYPASSRLS), so it is unaffected.
ALTER TABLE public._migrations ENABLE ROW LEVEL SECURITY;

-- ---------- 3. Close authenticated the way 33 closed anon ----------
-- Belt and braces: with invoker views, RLS already stops this role
-- from seeing rows, but a live grant behind an RLS toggle is a trap for
-- whoever next adds a policy (33's words). Take the grants away too.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;

-- 33 revoked SELECT on the views it knew about and ALL on the tables it
-- listed. Make anon uniform as well, so nothing depends on which
-- migration happened to create an object.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

COMMIT;

-- PostgREST caches the schema; view options and grant changes need a
-- reload to take.
NOTIFY pgrst, 'reload schema';
