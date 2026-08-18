import { Suspense } from "react";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { TabBar } from "@/components/shared/TabBar";
import { MatchCard } from "@/components/matches/MatchCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabasePublic } from "@/lib/supabase-public";
import { getCurrentTeam } from "@/lib/team";
import type { Match, MatchParticipantPublic } from "@/types";

// Scheduled-only view of the matches list (played matches live on
// /matches) — same data pattern as app/matches/page.tsx.
async function ScheduledMatchesData() {
  const team = await getCurrentTeam();
  const [matchesRes, participantsRes] = await Promise.all([
    supabasePublic
      .from("matches_public")
      .select("*")
      .eq("team_id", team.id)
      .eq("status", "scheduled"),
    supabasePublic
      .from("match_participants_public")
      .select("match_id, is_playing")
      .eq("team_id", team.id),
  ]);

  const counts = new Map<string, number>();
  for (const row of (participantsRes.data ?? []) as Pick<
    MatchParticipantPublic,
    "match_id" | "is_playing"
  >[]) {
    // Charge-only captain rows aren't attendance.
    if (!row.is_playing) continue;
    counts.set(row.match_id, (counts.get(row.match_id) ?? 0) + 1);
  }

  // Upcoming soonest first.
  const scheduled = ((matchesRes.data ?? []) as Match[]).sort((a, b) =>
    a.match_date < b.match_date ? -1 : 1,
  );

  if (scheduled.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
        No matches scheduled — use Schedule a Match to add one.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      {scheduled.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          attendeeCount={counts.get(match.id) ?? 0}
        />
      ))}
    </section>
  );
}

function ScheduledMatchesSkeleton() {
  return (
    <>
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
    </>
  );
}

export default function ScheduledMatches() {
  return (
    <div className="min-h-svh bg-background pb-28">
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">
            Scheduled Matches
          </h1>
          <p className="mt-0.5 text-xs text-text-muted">
            Upcoming matches, soonest first.
          </p>
        </div>
        <Suspense fallback={<ScheduledMatchesSkeleton />}>
          <ScheduledMatchesData />
        </Suspense>
      </main>
      <TabBar />
    </div>
  );
}
