import { Suspense } from "react";
import { ScheduledMatchList } from "@/components/matches/ScheduledMatchList";
import { Skeleton } from "@/components/ui/skeleton";
import { supabaseServer } from "@/lib/supabase-server";
import { AccessGate } from "@/components/shared/AccessGate";
import { checkActiveTeamRead } from "@/lib/access";
import type { Match } from "@/types";

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
  // The verdict already carries the team id; no team config is needed here.
  const team = { id: verdict.teamId };
  // Attendance is written at completion (lib/matches.ts), so a scheduled
  // match never has participants — no counts query here. Ordered in SQL
  // (matches_team_status_date_idx, migration 45), soonest first.
  const matchesRes = await supabaseServer
    .from("matches_public")
    .select("*")
    .eq("team_id", team.id)
    .eq("status", "scheduled")
    .order("match_date", { ascending: true });

  const scheduled = (matchesRes.data ?? []) as Match[];

  if (scheduled.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface shadow-card p-4 text-sm text-text-muted">
        No matches scheduled — use Schedule a Match to add one.
      </p>
    );
  }

  return <ScheduledMatchList matches={scheduled} counts={{}} />;
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
        <h1 className="text-xl font-bold text-text-primary">Matches</h1>
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
