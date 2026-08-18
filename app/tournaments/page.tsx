import { Suspense } from "react";
import { TabBar } from "@/components/shared/TabBar";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { CreateTournamentSheet } from "@/components/tournaments/CreateTournamentSheet";
import { getSessionAdmin } from "@/lib/session";
import { supabasePublic } from "@/lib/supabase-public";
import { getCurrentTeam, getTeamGrounds } from "@/lib/team";
import type { TournamentPublic } from "@/types";

function CardList({ tournaments }: { tournaments: TournamentPublic[] }) {
  return (
    <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {tournaments.map((t) => (
        <TournamentCard key={t.id} tournament={t} />
      ))}
    </section>
  );
}

async function TournamentsData() {
  const team = await getCurrentTeam();
  const [res, admin, grounds] = await Promise.all([
    supabasePublic
      .from("tournaments_public")
      .select("*")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false }),
    getSessionAdmin(),
    getTeamGrounds(team.id),
  ]);
  const tournaments = (res.data ?? []) as TournamentPublic[];
  const active = tournaments.filter((t) => t.status === "active");
  const past = tournaments.filter((t) => t.status === "completed");
  const isAdmin = !!admin && !admin.mustChangePassword;

  return (
    <>
      {isAdmin && <CreateTournamentSheet grounds={grounds} />}

      {tournaments.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
          No tournaments yet
          {isAdmin
            ? " — create the first one above."
            : " — an admin can create one."}{" "}
          Every tournament keeps its own players and ledger, separate from the
          team-ledger group.
        </p>
      )}

      {active.length > 0 && (
        <>
          <h2 className="px-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            Active
          </h2>
          <CardList tournaments={active} />
        </>
      )}

      {past.length > 0 && (
        <>
          <h2 className="px-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            Past
          </h2>
          <CardList tournaments={past} />
        </>
      )}
    </>
  );
}

export default function Tournaments() {
  return (
    <div className="min-h-svh bg-background pb-28">
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <h1 className="text-xl font-semibold text-text-primary">Tournaments</h1>
        <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
          <TournamentsData />
        </Suspense>
      </main>
      <TabBar />
    </div>
  );
}
