import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PlayerGrid } from "@/components/dashboard/PlayerGrid";
import { PoolSummaryCard } from "@/components/dashboard/PoolSummaryCard";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateShort } from "@/lib/format";
import { canWrite } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import type {
  PlayerPublic,
  TournamentPlayerPublic,
  TournamentPublic,
} from "@/types";

// No ₹900 threshold in tournaments — map onto the PlayerPublic shape
// so PlayerGrid/PlayerCard render unchanged (clear → the surplus/green
// styling; captain flags drive the crown marks, migration-20).
function toPlayerPublic(p: TournamentPlayerPublic): PlayerPublic {
  return {
    id: p.id,
    name: p.name,
    is_active: p.is_active,
    balance: Number(p.balance),
    status: p.status === "clear" ? "surplus" : p.status,
    is_captain: p.is_captain,
    is_vice_captain: p.is_vice_captain,
  };
}

function tournamentSubtitle(t: TournamentPublic): string {
  return [
    t.team_name,
    t.venue,
    t.start_date &&
      (t.end_date
        ? `${formatDateShort(t.start_date)} – ${formatDateShort(t.end_date)}`
        : formatDateShort(t.start_date)),
  ]
    .filter(Boolean)
    .join(" · ");
}

// The tournament mini-app's Home tab — the dashboard analogue: fund
// card + roster with balances. Ledger and admin live on their tabs.
async function TournamentHomeData({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, admin] = await Promise.all([params, getSessionAdmin()]);
  const signedInAdmin = !!admin && !admin.mustChangePassword;
  const [tRes, playersRes, countRes] = await Promise.all([
    supabaseServer
      .from("tournaments_public")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabaseServer
      .from("tournament_players_public")
      .select("*")
      .eq("tournament_id", id),
    supabaseServer
      .from("tournament_ledger_public")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", id),
  ]);

  const tournament = tRes.data as TournamentPublic | null;
  if (!tournament) notFound();

  // Rights come from this tournament's own scope — its hosting team, or
  // the tournament itself for a standalone purchase. Being an admin of
  // some other team grants nothing here, and the megaadmin reads but
  // never writes (canWrite refuses it).
  const isAdmin =
    signedInAdmin &&
    (tournament.team_id
      ? canWrite(admin, "team", tournament.team_id)
      : canWrite(admin, "tournament", tournament.id));
  const players = (playersRes.data ?? []) as TournamentPlayerPublic[];

  // Dashboard sort rule: biggest debtors first, inactive last, name tiebreak.
  const roster = players
    .map(toPlayerPublic)
    .sort(
      (a, b) =>
        Number(a.is_active === false) - Number(b.is_active === false) ||
        a.balance - b.balance ||
        a.name.localeCompare(b.name),
    );

  const subtitle = tournamentSubtitle(tournament);

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text-primary">
          {tournament.name}
        </h1>
        {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
      </section>

      {tournament.status === "completed" && (
        <p className="rounded-lg bg-inactive-light px-4 py-2 text-sm text-inactive-foreground">
          This tournament is completed — the ledger is read-only.
        </p>
      )}

      <PoolSummaryCard
        label="Tournament fund"
        balance={Number(tournament.fund_balance)}
        entryCount={countRes.count ?? 0}
      />

      <PlayerGrid
        players={roster}
        hrefBase={`/tournaments/${id}/players`}
        emptyCopy={
          isAdmin
            ? "No players yet — add them from Admin → Manage Players."
            : "No players yet — an admin can add them."
        }
      />
    </>
  );
}

export default function TournamentHome({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-svh bg-background pb-28">
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <Suspense
          fallback={
            <>
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-64 rounded-lg" />
            </>
          }
        >
          <TournamentHomeData params={params} />
        </Suspense>
      </main>
    </div>
  );
}
