import { Suspense } from "react";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { TabBar } from "@/components/shared/TabBar";
import { MatchCard } from "@/components/matches/MatchCard";
import { ScheduleOtherMatch } from "@/components/slots/ScheduleOtherMatch";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionAdmin } from "@/lib/session";
import { supabasePublic } from "@/lib/supabase-public";
import { getCurrentTeam, getTeamGrounds } from "@/lib/team";
import type { Match, MatchParticipantPublic } from "@/types";

// Away matches have no pre-booked slot list — admins schedule them
// free-form (date + opponent + ground name), INSERTed with
// ground = 'away'. The public sees the resulting match cards here
// and on /matches alike.
async function OtherMatchesData() {
  const team = await getCurrentTeam();
  const [matchesRes, participantsRes, captainRes, admin, grounds] = await Promise.all([
    supabasePublic
      .from("matches_public")
      .select("*")
      .eq("team_id", team.id)
      .eq("ground", "away"),
    supabasePublic
      .from("match_participants_public")
      .select("match_id, is_playing")
      .eq("team_id", team.id),
    supabasePublic
      .from("players_public")
      .select("name")
      .eq("team_id", team.id)
      .eq("is_captain", true)
      .maybeSingle(),
    getSessionAdmin(),
    getTeamGrounds(team.id),
  ]);
  const captainName = (captainRes.data as { name: string } | null)?.name ?? null;

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

  // Same ordering as /matches: upcoming soonest first, played newest first.
  const scheduled = matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => (a.match_date < b.match_date ? -1 : 1));
  const played = matches
    .filter((m) => m.status !== "scheduled")
    .sort((a, b) => (a.match_date < b.match_date ? 1 : -1));

  const canSchedule = !!admin && !admin.mustChangePassword;

  return (
    <>
      {canSchedule && (
        <ScheduleOtherMatch grounds={grounds} captainName={captainName} />
      )}

      {matches.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
          No away matches yet
          {canSchedule
            ? " — schedule the first one above."
            : " — matches at other grounds will appear here."}
        </p>
      )}

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

export default function OtherSlots() {
  return (
    <div className="min-h-svh bg-background pb-28">
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Away Matches</h1>
          <p className="mt-0.5 text-xs text-text-muted">
            Away matches at other grounds
          </p>
        </div>
        <Suspense
          fallback={
            <>
              <Skeleton className="h-11 rounded-md" />
              <Skeleton className="h-64 rounded-lg" />
            </>
          }
        >
          <OtherMatchesData />
        </Suspense>
      </main>
      <TabBar />
    </div>
  );
}
