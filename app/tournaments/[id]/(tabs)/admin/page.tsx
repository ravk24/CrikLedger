import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentAdminPanel } from "@/components/tournaments/TournamentAdminPanel";
import { pool } from "@/lib/db";
import { canWrite, isScopeSuperadmin } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import type { TournamentPlayerPublic, TournamentPublic } from "@/types";

// The tournament mini-app's admin console tab. Admin-gated server-side
// (the tab is hidden for non-admins; direct URLs bounce to Home).
// Writes are still authorized per-request by the API routes.
async function TournamentAdminData({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // The session is React-cached (the tab bar in the layout resolves the
  // same promise), so reading it first costs nothing and lets the
  // captain-phone read ride the Promise.all for a signed-in caller
  // instead of running as a second serial stage after the gate below.
  const [{ id }, admin] = await Promise.all([params, getSessionAdmin()]);
  const signedIn = !!admin && !admin.mustChangePassword;
  const [tRes, playersRes, phoneRes] = await Promise.all([
    supabaseServer
      .from("tournaments_public")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabaseServer
      .from("tournament_players_public")
      .select("*")
      .eq("tournament_id", id),
    // phone is deliberately absent from tournament_players_public
    // (migration 44) — read off the base table. Only a signed-in
    // account triggers the read; the value is USED only past the
    // canEdit gate, so a bounced visitor never sees it.
    signedIn
      ? pool.query<{ phone: string | null }>(
          `SELECT phone FROM tournament_players
            WHERE tournament_id = $1 AND is_captain LIMIT 1`,
          [id],
        )
      : null,
  ]);

  const tournament = tRes.data as TournamentPublic | null;
  if (!tournament) notFound();
  if (!admin || admin.mustChangePassword) redirect(`/tournaments/${id}`);

  // Rights come from the tournament's own scope: its hosting team, or
  // the tournament itself when a Tournament-Credit buyer owns no team.
  const canEdit = tournament.team_id
    ? canWrite(admin, "team", tournament.team_id)
    : canWrite(admin, "tournament", tournament.id);
  if (!canEdit) redirect(`/tournaments/${id}`);
  const isSuperadmin = tournament.team_id
    ? isScopeSuperadmin(admin, "team", tournament.team_id)
    : isScopeSuperadmin(admin, "tournament", tournament.id);

  const players = (playersRes.data ?? []) as TournamentPlayerPublic[];

  const captainPhone = phoneRes?.rows[0]?.phone ?? null;

  return (
    <>
      <h1 className="text-xl font-semibold text-text-primary">Admin</h1>

      <TournamentAdminPanel
        tournament={tournament}
        players={players}
        captainPhone={captainPhone}
        isSuperadmin={isSuperadmin}
      />
    </>
  );
}

export default function TournamentAdmin({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-svh bg-background pb-28">
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
          <TournamentAdminData params={params} />
        </Suspense>
      </main>
    </div>
  );
}
