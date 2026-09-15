import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentMatchCard } from "@/components/tournaments/TournamentMatchCard";
import { formatMonth } from "@/lib/format";
import { canWrite } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import type { TournamentMatch, TournamentPublic } from "@/types";

// Scheduled-only view of the tournament's matches (played ones live on
// ../completed) — the SG /schedule/upcoming analogue. Tournaments run
// whole days in slots, so time is the secondary sort. No filter select:
// opponent is NOT NULL and there are no per-match fees, so the SG
// filters have nothing to filter on.
async function TournamentUpcomingData({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, admin] = await Promise.all([params, getSessionAdmin()]);
  const signedInAdmin = !!admin && !admin.mustChangePassword;
  const [tRes, matchesRes] = await Promise.all([
    supabaseServer
      .from("tournaments_public")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabaseServer
      .from("tournament_matches_public")
      .select("*")
      .eq("tournament_id", id)
      .eq("status", "scheduled"),
  ]);

  const tournament = tRes.data as TournamentPublic | null;
  if (!tournament) notFound();

  const isAdmin =
    signedInAdmin &&
    (tournament.team_id
      ? canWrite(admin, "team", tournament.team_id)
      : canWrite(admin, "tournament", tournament.id));

  const key = (m: TournamentMatch) => `${m.match_date} ${m.match_time}`;
  const scheduled = ((matchesRes.data ?? []) as TournamentMatch[]).sort(
    (a, b) => (key(a) < key(b) ? -1 : 1),
  );

  return (
    <>
      {tournament.status === "completed" && (
        <p className="rounded-lg bg-inactive-light px-4 py-2 text-sm text-inactive-foreground">
          This tournament is completed — matches are read-only.
        </p>
      )}

      {scheduled.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface shadow-card p-4 text-sm text-text-muted">
          {isAdmin && tournament.status === "active"
            ? "No matches scheduled — use Schedule a Match to add one."
            : "No matches scheduled — an admin can add them."}
        </p>
      ) : (
        <section className="flex flex-col gap-2">
          {groupByMonth(scheduled).map(([month, rows]) => (
            <div key={month} className="flex flex-col gap-2">
              <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {month}
              </h2>
              {rows.map((match) => (
                <TournamentMatchCard
                  key={match.id}
                  match={match}
                  attendeeCount={0}
                />
              ))}
            </div>
          ))}
        </section>
      )}
    </>
  );
}

// Local copy of ScheduledMatchList's grouper (that one is typed on the
// SG Match and carries client filters tournaments don't need). Rows
// arrive date-sorted, so consecutive runs share a month; labels are
// computed in IST like every other date on the page.
function groupByMonth(rows: TournamentMatch[]): [string, TournamentMatch[]][] {
  const groups: [string, TournamentMatch[]][] = [];
  for (const m of rows) {
    const label = formatMonth(m.match_date);
    const last = groups[groups.length - 1];
    if (last && last[0] === label) last[1].push(m);
    else groups.push([label, [m]]);
  }
  return groups;
}

export default function TournamentUpcoming({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-svh bg-background pb-28">
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            Matches
          </h1>
          <p className="mt-0.5 text-xs text-text-muted">
            Upcoming matches, soonest first.
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
          <TournamentUpcomingData params={params} />
        </Suspense>
      </main>
    </div>
  );
}
