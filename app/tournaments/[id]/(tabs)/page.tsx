import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PlayerGrid } from "@/components/dashboard/PlayerGrid";
import { PoolSummaryCard } from "@/components/dashboard/PoolSummaryCard";
import { DownloadImageButton } from "@/components/shared/DownloadImageButton";
import { Skeleton } from "@/components/ui/skeleton";
import { pool } from "@/lib/db";
import { buildDuesMessage } from "@/lib/feeMessage";
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

  // Companion text for the balances share: owing players (negative
  // balance = in debt to the fund, per the view's status rule) settle
  // via the tournament captain. Biggest debtor first, matching the
  // image order; the captain is excluded — they cannot transfer to
  // themselves. Works for active tournaments too: deposits and shared
  // expenses move balances long before settlement runs at completion.
  const captainRow = players.find((p) => p.is_captain) ?? null;
  const owing = players
    .filter((p) => p.is_active && Number(p.balance) < 0 && !p.is_captain)
    .sort((a, b) => Number(a.balance) - Number(b.balance))
    .map((p) => p.name);

  // phone is deliberately absent from tournament_players_public
  // (migration 44) — read off the base table, only for admins with a
  // message to build, so anonymous renders never touch it.
  const captainPhone =
    isAdmin && captainRow && owing.length > 0
      ? ((
          await pool.query<{ phone: string | null }>(
            `SELECT phone FROM tournament_players
              WHERE tournament_id = $1 AND is_captain LIMIT 1`,
            [id],
          )
        ).rows[0]?.phone ?? null)
      : null;

  const shareText =
    captainRow && captainPhone && owing.length > 0
      ? buildDuesMessage({
          captainName: captainRow.name,
          captainPhone,
          players: owing,
        })
      : undefined;

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
        downloadSlot={
          isAdmin ? (
            <DownloadImageButton
              endpoint={`/api/share/tournament-balances?id=${id}`}
              filename={`${tournament.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-balances.png`}
              title={`${tournament.name} · Balances`}
              shareText={shareText}
            />
          ) : null
        }
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
