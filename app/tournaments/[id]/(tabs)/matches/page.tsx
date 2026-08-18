import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentMatchCard } from "@/components/tournaments/TournamentMatchCard";
import { canWrite } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import type { TournamentMatch, TournamentPublic } from "@/types";

// The tournament mini-app's Matches tab — the /matches analogue.
// Tournaments run whole days in slots, so time is the secondary sort.
async function TournamentMatchesData({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, admin] = await Promise.all([params, getSessionAdmin()]);
  const signedInAdmin = !!admin && !admin.mustChangePassword;
  const [tRes, matchesRes, participantsRes] = await Promise.all([
    supabaseServer
      .from("tournaments_public")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabaseServer
      .from("tournament_matches_public")
      .select("*")
      .eq("tournament_id", id),
    supabaseServer
      .from("tournament_match_participants_public")
      .select("match_id")
      .eq("tournament_id", id),
  ]);

  const tournament = tRes.data as TournamentPublic | null;
  if (!tournament) notFound();

  // Rights come from this tournament's own scope — its hosting team, or
  // the tournament itself for a standalone purchase. Being an admin of
  // some other team grants nothing here, and the megaadmin reads but
  // never writes (canWrite refuses it).
  const isAdmin =
    signedInAdmin &&
    (tournament.team_id
      ? canWrite(admin, "team", tournament.team_id)
      : canWrite(admin, "tournament", tournament.id));
  const matches = (matchesRes.data ?? []) as TournamentMatch[];

  const counts = new Map<string, number>();
  for (const row of (participantsRes.data ?? []) as { match_id: string }[]) {
    counts.set(row.match_id, (counts.get(row.match_id) ?? 0) + 1);
  }

  const key = (m: TournamentMatch) => `${m.match_date} ${m.match_time}`;
  const upcoming = matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => (key(a) < key(b) ? -1 : 1));
  const played = matches
    .filter((m) => m.status !== "scheduled")
    .sort((a, b) => (key(a) < key(b) ? 1 : -1));

  return (
    <>
      <h1 className="text-xl font-semibold text-text-primary">Matches</h1>

      {tournament.status === "completed" && (
        <p className="rounded-lg bg-inactive-light px-4 py-2 text-sm text-inactive-foreground">
          This tournament is completed — matches are read-only.
        </p>
      )}

      {matches.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
          No matches yet
          {isAdmin && tournament.status === "active"
            ? " — schedule one from Admin → Schedule Matches."
            : " — an admin can schedule them."}
        </p>
      )}

      {upcoming.length > 0 && (
        <>
          <h2 className="px-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            Upcoming
          </h2>
          <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {upcoming.map((m) => (
              <TournamentMatchCard
                key={m.id}
                match={m}
                attendeeCount={counts.get(m.id) ?? 0}
              />
            ))}
          </section>
        </>
      )}

      {played.length > 0 && (
        <>
          <h2 className="px-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            Played
          </h2>
          <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {played.map((m) => (
              <TournamentMatchCard
                key={m.id}
                match={m}
                attendeeCount={counts.get(m.id) ?? 0}
              />
            ))}
          </section>
        </>
      )}

    </>
  );
}

export default function TournamentMatches({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-svh bg-background pb-28">
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
          <TournamentMatchesData params={params} />
        </Suspense>
      </main>
    </div>
  );
}
