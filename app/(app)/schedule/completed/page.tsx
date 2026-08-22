import { Suspense } from "react";
import { MatchCard } from "@/components/matches/MatchCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabaseServer } from "@/lib/supabase-server";
import { AccessGate } from "@/components/shared/AccessGate";
import { checkActiveTeamRead } from "@/lib/access";
import type { Match } from "@/types";

// Played-only view of the matches list (upcoming ones live on
// /schedule/upcoming) — same data pattern as its sibling. Abandoned
// matches ride along with completed ones: both are done, and
// ResultBadge already tells them apart on the card.
async function CompletedMatchesData() {
  // Team data needs a session whose membership matches. Renders a panel
  // rather than throwing — a member who is merely signed out should see
  // "sign in", not a broken page.
  const verdict = await checkActiveTeamRead();
  if (!verdict.ok) {
    return (
      <AccessGate
        verdict={verdict}
        what="completed matches"
        next="/schedule/completed"
      />
    );
  }
  // The verdict already carries the team id; no team config is needed here.
  const team = { id: verdict.teamId };
  const [matchesRes, participantsRes] = await Promise.all([
    supabaseServer
      .from("matches_public")
      .select("*")
      .eq("team_id", team.id)
      .neq("status", "scheduled"),
    supabaseServer
      .from("match_attendee_counts")
      .select("match_id, attendee_count")
      .eq("team_id", team.id),
  ]);

  const counts = new Map(
    (
      (participantsRes.data ?? []) as {
        match_id: string;
        attendee_count: number;
      }[]
    ).map((r) => [r.match_id, r.attendee_count]),
  );

  // Most recent first.
  const played = ((matchesRes.data ?? []) as Match[]).sort((a, b) =>
    a.match_date < b.match_date ? 1 : -1,
  );

  if (played.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
        No matches played yet — completed matches will appear here.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      {played.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          // Guests played too, so they count towards attendance here.
          attendeeCount={
            (counts.get(match.id) ?? 0) + (match.guest_names?.length ?? 0)
          }
        />
      ))}
    </section>
  );
}

function CompletedMatchesSkeleton() {
  return (
    <>
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
    </>
  );
}

export default function CompletedMatches() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">Completed</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Played matches, most recent first.
        </p>
      </div>
      <Suspense fallback={<CompletedMatchesSkeleton />}>
        <CompletedMatchesData />
      </Suspense>
    </>
  );
}
