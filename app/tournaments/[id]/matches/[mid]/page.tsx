import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Car, ChevronLeft } from "lucide-react";
import { CaptainMark } from "@/components/shared/CaptainMark";
import { ResultBadge } from "@/components/shared/ResultBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentBackLink } from "@/components/tournaments/TournamentBackLink";
import { TournamentMatchAdminActions } from "@/components/tournaments/TournamentMatchAdminActions";
import { pool } from "@/lib/db";
import {
  formatDate,
  formatDateShort,
  formatTime,
  formatWeekday,
  teamLabel,
} from "@/lib/format";
import { canWrite, isScopeSuperadmin } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import { getTeamById } from "@/lib/team";
import type { WizardInitial } from "@/components/wizard/wizardTypes";
import type {
  MatchParticipantPublic,
  TournamentMatch,
  TournamentPublic,
} from "@/types";
import { CHROME_BACK_LINK, CHROME_HEADER } from "@/lib/ui";

// Sibling of the SG match detail page, scoped to the tournament's
// isolated data — no bookings, no other-fee, no guests.
async function buildAdminProps(
  tournament: TournamentPublic,
  match: TournamentMatch,
) {
  const admin = await getSessionAdmin();
  if (!admin || admin.mustChangePassword) return null;

  // Rights come from this tournament's own scope — its hosting team, or
  // the tournament itself for a standalone Tournament-Credit purchase.
  // Being an admin elsewhere grants nothing here, and the megaadmin
  // reads this page but never edits it.
  const scope = tournament.team_id
    ? { kind: "team" as const, id: tournament.team_id }
    : { kind: "tournament" as const, id: tournament.id };
  if (!canWrite(admin, scope.kind, scope.id)) return null;
  const isSuperadmin = isScopeSuperadmin(admin, scope.kind, scope.id);

  // Recently-played first, then alphabetical — scoped to this tournament.
  // Both admin reads are independent, so they run together.
  const [playersRes, rowsRes] = await Promise.all([
    pool.query(
      `SELECT tp.id, tp.name, tp.is_captain
       FROM tournament_players tp
       LEFT JOIN (
         SELECT tmp.player_id, MAX(tm.match_date) AS last_played
         FROM tournament_match_participants tmp
         JOIN tournament_matches tm ON tm.id = tmp.match_id
           AND tm.status = 'completed'
         WHERE tmp.tournament_id = $1
         GROUP BY tmp.player_id
       ) lp ON lp.player_id = tp.id
       WHERE tp.is_active AND tp.tournament_id = $1
       ORDER BY lp.last_played DESC NULLS LAST, tp.name ASC`,
      [tournament.id],
    ),
    match.status === "completed"
      ? pool.query(
          `SELECT player_id, brought_car, shared_car
           FROM tournament_match_participants WHERE match_id = $1`,
          [match.id],
        )
      : Promise.resolve({ rows: [] as never[] }),
  ]);
  const players = (
    playersRes.rows as { id: string; name: string; is_captain: boolean }[]
  ).map((p) => ({ id: p.id, name: p.name, is_captain: p.is_captain }));

  let initial: WizardInitial | undefined;
  if (match.status === "completed") {
    const selected: string[] = [];
    const cars: string[] = [];
    const shared: string[] = [];
    for (const row of rowsRes.rows) {
      selected.push(row.player_id);
      if (row.brought_car) cars.push(row.player_id);
      if (row.shared_car) shared.push(row.player_id);
    }
    initial = {
      result: match.result ?? "won",
      costs: {
        ground: String(Math.round(Number(match.ground_fee))),
        ball: String(Math.round(Number(match.ball_fee))),
        other: String(Math.round(Number(match.other_fee))),
        allowance: String(Math.round(Number(match.car_allowance_per_car))),
      },
      selected,
      cars,
      shared,
      guests: [],
    };
  }

  return { players, isSuperadmin, initial };
}

async function TournamentMatchData({
  params,
}: {
  params: Promise<{ id: string; mid: string }>;
}) {
  const { id, mid } = await params;
  const [tRes, matchRes, participantsRes] = await Promise.all([
    supabaseServer
      .from("tournaments_public")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabaseServer
      .from("tournament_matches_public")
      .select("*")
      .eq("id", mid)
      .eq("tournament_id", id)
      .maybeSingle(),
    supabaseServer
      .from("tournament_match_participants_public")
      .select("*")
      .eq("match_id", mid),
  ]);

  const tournament = tRes.data as TournamentPublic | null;
  const match = matchRes.data as TournamentMatch | null;
  if (!tournament || !match) notFound();

  // Team from the RESOURCE, not the session — this match sheet is
  // publicly link-readable and must render with no active team.
  const [team, adminProps] = await Promise.all([
    tournament.team_id ? getTeamById(tournament.team_id) : null,
    tournament.status === "active" ? buildAdminProps(tournament, match) : null,
  ]);
  const participants = (participantsRes.data ??
    []) as MatchParticipantPublic[];

  const carCount = participants.filter((p) => p.brought_car).length;

  return (
    <>
      <section className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-text-primary">
            {tournament.team_name ?? (team ? teamLabel(team) : "Our side")} vs{" "}
            {match.opponent}
          </h1>
          <ResultBadge match={match} />
        </div>
        <p className="text-sm text-text-secondary">
          {formatWeekday(match.match_date)}
          {" · "}
          {formatDate(match.match_date)}
          {" · "}
          {formatTime(match.match_time)}
        </p>
        <p className="text-sm text-text-secondary">
          Ground: {tournament.venue?.trim() || "Not set"}
        </p>
      </section>

      {tournament.status === "completed" && (
        <p className="rounded-lg bg-inactive-light px-4 py-2 text-sm text-inactive-foreground">
          This tournament is completed — the match is read-only.
        </p>
      )}

      {match.status === "abandoned" && (
        <p className="rounded-lg bg-inactive-light px-4 py-2 text-sm text-inactive-foreground">
          Abandoned — {match.abandoned_reason}. It doesn&apos;t count toward the
          tournament fee split.
        </p>
      )}

      {adminProps && (
        <TournamentMatchAdminActions
          tournamentId={id}
          matchId={match.id}
          opponent={match.opponent}
          matchDate={String(match.match_date).slice(0, 10)}
          matchTime={match.match_time}
          matchDateLabel={`${formatDateShort(match.match_date)} · ${formatTime(match.match_time)}`}
          status={match.status}
          venue={tournament.venue}
          players={adminProps.players}
          isSuperadmin={adminProps.isSuperadmin}
          initial={adminProps.initial}
        />
      )}

      {match.status === "completed" && (
        <>
          {/* Attendance only — the participation fee settles for the whole
              tournament at Mark as completed, not per match. */}
          <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
            <div className="flex items-baseline justify-between border-b border-border px-4 py-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                {participants.length}{" "}
                {participants.length === 1 ? "player" : "players"}
              </span>
              {Number(match.car_allowance_per_car) > 0 && (
                <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  ₹{Math.round(Number(match.car_allowance_per_car))} / car ·{" "}
                  {carCount} {carCount === 1 ? "car" : "cars"}
                </span>
              )}
            </div>
            <div className="divide-y divide-border">
              {participants.map((p, i) => (
                <div
                  key={i}
                  className="flex min-h-11 items-center gap-2 px-4 py-2"
                >
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-text-primary">
                    {p.player_name}
                    {p.is_captain && <CaptainMark compact />}
                  </span>
                  {p.brought_car && (
                    <Car
                      size={16}
                      aria-label="Brought a car"
                      className="shrink-0 text-accent"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
          <p className="text-xs text-text-muted">
            Fees settle for the whole tournament when it is marked completed —
            this match&apos;s slice of the joining fee splits across the players
            who played it, and its car money across everyone who shared a
            ride — drivers included.
          </p>
          {match.updated_by_name && (
            <p className="text-center text-xs text-text-muted">
              Last updated by {match.updated_by_name}
              {match.updated_at && ` on ${formatDate(match.updated_at)}`}
            </p>
          )}
        </>
      )}

      {match.status === "scheduled" && (
        <p className="rounded-lg border border-border bg-surface shadow-card p-4 text-sm text-text-muted">
          {tournament.status === "completed"
            ? "This tournament is completed — reopen it to record this match."
            : "Upcoming match — awaiting completion by an admin."}
        </p>
      )}
    </>
  );
}

// Status-aware back link, mirroring the SG match page: a scheduled
// match came from Scheduled, anything else from Completed. Needs the
// match row, so it streams over the pathname-based fallback.
async function BackLink({
  params,
}: {
  params: Promise<{ id: string; mid: string }>;
}) {
  const { id, mid } = await params;
  const { data } = await supabaseServer
    .from("tournament_matches_public")
    .select("status")
    .eq("id", mid)
    .maybeSingle();
  const scheduled = (data as { status: string } | null)?.status === "scheduled";
  return (
    <Link
      href={`/tournaments/${id}/schedule/${scheduled ? "upcoming" : "completed"}`}
      className={CHROME_BACK_LINK}
    >
      <ChevronLeft size={18} />
      {scheduled ? "Upcoming" : "Completed"}
    </Link>
  );
}

export default function TournamentMatchDetail({
  params,
}: {
  params: Promise<{ id: string; mid: string }>;
}) {
  return (
    <div className="min-h-svh bg-background pb-16">
      <header className={CHROME_HEADER}>
        <div className="mx-auto flex max-w-md items-center gap-1 px-2 py-3">
          <Suspense
            fallback={<TournamentBackLink segment="schedule" label="Schedule" />}
          >
            <BackLink params={params} />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <Suspense
          fallback={
            <>
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-64 rounded-lg" />
            </>
          }
        >
          <TournamentMatchData params={params} />
        </Suspense>
      </main>
    </div>
  );
}
