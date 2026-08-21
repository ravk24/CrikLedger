import { Suspense } from "react";
import { MatchCard } from "@/components/matches/MatchCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabaseServer } from "@/lib/supabase-server";
import { AccessGate } from "@/components/shared/AccessGate";
import { checkActiveTeamRead } from "@/lib/access";
import { buildAttendeeCounts } from "@/lib/matches";
import { getCurrentTeam } from "@/lib/team";
import type { Match, MatchParticipantPublic } from "@/types";

// Scheduled-only view of the matches list (played ones live on
// /schedule/completed) — same data pattern as its sibling.
async function ScheduledMatchesData() {
  // Team data needs a session whose membership matches. Renders a panel
  // rather than throwing — a member who is merely signed out should see
  // "sign in", not a broken page.
  const verdict = await checkActiveTeamRead();
  if (!verdict.ok) {
    return <AccessGate verdict={verdict} what="scheduled matches" next="/schedule/upcoming" />;
  }
  const team = await getCurrentTeam();
  const [matchesRes, participantsRes] = await Promise.all([
    supabaseServer
      .from("matches_public")
      .select("*")
      .eq("team_id", team.id)
      .eq("status", "scheduled"),
    supabaseServer
      .from("match_participants_public")
      .select("match_id, is_playing")
      .eq("team_id", team.id),
  ]);

  const counts = buildAttendeeCounts(
    (participantsRes.data ?? []) as Pick<
      MatchParticipantPublic,
      "match_id" | "is_playing"
    >[],
  );

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
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">Scheduled</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Upcoming matches, soonest first.
        </p>
      </div>
      <Suspense fallback={<ScheduledMatchesSkeleton />}>
        <ScheduledMatchesData />
      </Suspense>
    </>
  );
}
