import { Suspense } from "react";
import { MatchCard } from "@/components/matches/MatchCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabaseServer } from "@/lib/supabase-server";
import { AccessGate } from "@/components/shared/AccessGate";
import { checkActiveTeamRead } from "@/lib/access";
import { buildAttendeeCounts } from "@/lib/matches";
import { getCurrentTeam } from "@/lib/team";
import type { Match, MatchParticipantPublic } from "@/types";

async function MatchesData() {
  // Team data needs a session whose membership matches. Renders a panel
  // rather than throwing — a member who is merely signed out should see
  // "sign in", not a broken page.
  const verdict = await checkActiveTeamRead();
  if (!verdict.ok) {
    return <AccessGate verdict={verdict} what="this team's matches" next="/matches" />;
  }
  const team = await getCurrentTeam();
  const [matchesRes, participantsRes] = await Promise.all([
    supabaseServer.from("matches_public").select("*").eq("team_id", team.id),
    supabaseServer
      .from("match_participants_public")
      .select("match_id, is_playing")
      .eq("team_id", team.id),
  ]);

  const matches = (matchesRes.data ?? []) as Match[];
  const counts = buildAttendeeCounts(
    (participantsRes.data ?? []) as Pick<
      MatchParticipantPublic,
      "match_id" | "is_playing"
    >[],
  );

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
    <>
      <h1 className="text-xl font-semibold text-text-primary">Matches</h1>
      <Suspense fallback={<MatchesSkeleton />}>
        <MatchesData />
      </Suspense>
    </>
  );
}
