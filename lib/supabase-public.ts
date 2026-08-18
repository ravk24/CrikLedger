import { createClient } from "@supabase/supabase-js";

// Anon client for public view reads only, used in Server Components.
// May SELECT only: teams_public, team_grounds_public, team_slots_public,
// players_public, pool_ledger_public, match_participants_public,
// pool_balance, matches_public, ground_bookings_public, player_statement,
// tournaments_public, tournament_players_public,
// tournament_ledger_public, tournament_player_statement,
// tournament_matches_public, tournament_match_participants_public,
// tournament_fee_charges_public, tournament_fee_breakdown_public.
// (The `matches` table itself left the anon surface in migration-29.)
// Every view exposes team_id — reads filter by the current team
// (lib/team.ts); the client is never trusted with the scope.
// All writes and admin reads go through the pg pool (lib/db.ts).
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);
