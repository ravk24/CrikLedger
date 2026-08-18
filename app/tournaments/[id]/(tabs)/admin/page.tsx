import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentAdminPanel } from "@/components/tournaments/TournamentAdminPanel";
import { canWrite, isScopeSuperadmin } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabasePublic } from "@/lib/supabase-public";
import { getTeamGrounds } from "@/lib/team";
import type { TournamentPlayerPublic, TournamentPublic } from "@/types";

// The tournament mini-app's admin console tab. Admin-gated server-side
// (the tab is hidden for non-admins; direct URLs bounce to Home).
// Writes are still authorized per-request by the API routes.
async function TournamentAdminData({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tRes, playersRes, admin] = await Promise.all([
    supabasePublic
      .from("tournaments_public")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabasePublic
      .from("tournament_players_public")
      .select("*")
      .eq("tournament_id", id),
    getSessionAdmin(),
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

  // Grounds belong to the hosting team; a standalone tournament has none.
  const grounds = tournament.team_id
    ? await getTeamGrounds(tournament.team_id)
    : [];
  const players = (playersRes.data ?? []) as TournamentPlayerPublic[];

  return (
    <>
      <h1 className="text-xl font-semibold text-text-primary">Admin</h1>

      <TournamentAdminPanel
        tournament={tournament}
        players={players}
        grounds={grounds}
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
