import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentMatchCard } from "@/components/tournaments/TournamentMatchCard";
import { supabaseServer } from "@/lib/supabase-server";
import type { TournamentMatch, TournamentPublic } from "@/types";

// Played view of the tournament's matches — the SG /schedule/completed
// analogue. Abandoned rides along with completed (the ResultBadge
// distinguishes), most recent first with time as the secondary sort.
async function TournamentCompletedData({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tRes, matchesRes, participantsRes] = await Promise.all([
    supabaseServer
      .from("tournaments_public")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabaseServer
      .from("tournament_matches_public")
      .select("*")
      .eq("tournament_id", id)
      .neq("status", "scheduled"),
    supabaseServer
      .from("tournament_match_participants_public")
      .select("match_id")
      .eq("tournament_id", id),
  ]);

  const tournament = tRes.data as TournamentPublic | null;
  if (!tournament) notFound();

  const counts = new Map<string, number>();
  for (const row of (participantsRes.data ?? []) as { match_id: string }[]) {
    counts.set(row.match_id, (counts.get(row.match_id) ?? 0) + 1);
  }

  const key = (m: TournamentMatch) => `${m.match_date} ${m.match_time}`;
  const played = ((matchesRes.data ?? []) as TournamentMatch[]).sort((a, b) =>
    key(a) < key(b) ? 1 : -1,
  );

  return (
    <>
      {tournament.status === "completed" && (
        <p className="rounded-lg bg-inactive-light px-4 py-2 text-sm text-inactive-foreground">
          This tournament is completed — matches are read-only.
        </p>
      )}

      {played.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface shadow-card p-4 text-sm text-text-muted">
          No matches played yet — completed matches will appear here.
        </p>
      ) : (
        <section className="flex flex-col gap-2">
          {played.map((match) => (
            <TournamentMatchCard
              key={match.id}
              match={match}
              attendeeCount={counts.get(match.id) ?? 0}
            />
          ))}
        </section>
      )}
    </>
  );
}

export default function TournamentCompleted({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-svh bg-background pb-28">
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            Completed
          </h1>
          <p className="mt-0.5 text-xs text-text-muted">
            Played matches, most recent first.
          </p>
        </div>
        <Suspense
          fallback={
            <>
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </>
          }
        >
          <TournamentCompletedData params={params} />
        </Suspense>
      </main>
    </div>
  );
}
