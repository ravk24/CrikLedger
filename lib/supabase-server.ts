import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY view reads. Renamed from lib/supabase-public.ts at
// Feature 4 M3, when the anon key stopped being able to read anything.
//
// Why this changed: the *_public views run as their owner, so they
// bypass the RLS on the underlying tables — that is what made them
// useful. But NEXT_PUBLIC_SUPABASE_ANON_KEY ships inside the browser
// bundle, so "server components read the views with the anon key" meant
// anyone could read every team's players, balances and ledger straight
// from PostgREST, whatever the UI showed. Migration 33 revokes those
// grants; this client uses the service role instead.
//
// The service role bypasses RLS entirely, so EVERY read through it must
// still filter by team itself (lib/team.ts) — the database is no longer
// a second line of defence here. Row-level enforcement is Feature 7.
//
// This module must NEVER reach the browser: importing it from a "use
// client" file would bundle the service key. There is no `server-only`
// package in this project, so the guard below is the enforcement — it
// throws loudly at import time rather than leaking silently.
if (typeof window !== "undefined") {
  throw new Error(
    "lib/supabase-server.ts imported in the browser — this module holds the " +
      "service role key and is server-only. Fetch via a route handler instead.",
  );
}

export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
