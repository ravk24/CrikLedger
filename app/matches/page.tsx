import { Suspense } from "react";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { TabBar } from "@/components/shared/TabBar";
import { MatchCard } from "@/components/matches/MatchCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabasePublic } from "@/lib/supabase-public";
import { getCurrentTeam } from "@/lib/team";
import type { Match, MatchParticipantPublic } from "@/types";

async function MatchesData() {
  const team = await getCurrentTeam();
  const [matchesRes, participantsRes] = await Promise.all([
    supabasePublic.from("matches_public").select("*").eq("team_id", team.id),
    supabasePublic
      .from("match_participants_public")
      .select("match_id, is_playing")
      .eq("team_id", team.id),
  ]);

  const matches = (matchesRes.data ?? []) as Match[];
  const counts = new Map<string, number>();
  for (const row of (participantsRes.data ?? []) as Pick<
    MatchParticipantPublic,
    "match_id" | "is_playing"
  >[]) {
    // Charge-only captain rows aren't attendance.
    if (!row.is_playing) continue;
    counts.set(row.match_id, (counts.get(row.match_id) ?? 0) + 1);
  }

  // Upcoming soonest first; played newest first.
  const scheduled = matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => (a.match_date < b.match_date ? -1 : 1));
  const played = matches
    .filter((m) => m.status !== "scheduled")
    .sort((a, b) => (a.match_date < b.match_date ? 1 : -1));

  if (matches.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
        No matches yet — the first scheduled match will appear here.
      </p>
    );
  }

  return (
    <>
      {scheduled.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            Upcoming
          </h2>
          {scheduled.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              attendeeCount={counts.get(match.id) ?? 0}
            />
          ))}
        </section>
      )}
      {played.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            Played
          </h2>
          {played.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              attendeeCount={
                (counts.get(match.id) ?? 0) + (match.guest_names?.length ?? 0)
              }
            />
          ))}
        </section>
      )}
    </>
  );
}

function MatchesSkeleton() {
  return (
    <>
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
    </>
  );
}

export default function Matches() {
  return (
    <div className="min-h-svh bg-background pb-28">
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <h1 className="text-xl font-semibold text-text-primary">Matches</h1>
        <Suspense fallback={<MatchesSkeleton />}>
          <MatchesData />
        </Suspense>
      </main>
      <TabBar />
    </div>
  );
}
