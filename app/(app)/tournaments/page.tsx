import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { CreateTournamentSheet } from "@/components/tournaments/CreateTournamentSheet";
import Link from "next/link";
import { getNavState } from "@/lib/nav";
import { canWrite } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
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

// Every tournament in the app, titles visible and rows inert, plus the
// always-clickable CTA that sells hosting. The TAB is navigable in every
// state — a visitor has to be able to see what is on offer; what a
// purchase unlocks is hosting, inside.
async function TournamentDirectory({ hosted }: { hosted: boolean }) {
  const { data } = await supabaseServer
    .from("tournaments_public")
    .select("id, name, status")
    .order("created_at", { ascending: false });
  const all = (data ?? []) as { id: string; name: string; status: string }[];

  return (
    <>
      <Link
        href="/purchases"
        className="flex h-11 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground"
      >
        {hosted ? "Host a new tournament" : "Manage your tournament"}
      </Link>

      {all.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
          No tournaments have been hosted yet.
        </p>
      ) : (
        <>
          <h2 className="px-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            Hosted on CrikLedger
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {all.map((t) => (
              // Plain text, not a control: there is nothing to disable,
              // so no aria-disabled and no <Link>.
              <li
                key={t.id}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-text-muted opacity-60"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {t.name}
                </span>
                <span className="shrink-0 text-[11px] capitalize">
                  {t.status}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

async function TournamentsData() {
  const nav = await getNavState();
  if (!nav.hasTournamentCredit) {
    return <TournamentDirectory hosted={false} />;
  }
  return <HostedTournaments />;
}

async function HostedTournaments() {
  const team = await getCurrentTeam();
  const [res, admin, grounds] = await Promise.all([
    supabaseServer
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
  const isAdmin =
    !!admin && !admin.mustChangePassword && canWrite(admin, "team", team.id);

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
    <>
      <h1 className="text-xl font-semibold text-text-primary">Tournaments</h1>
      <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
        <TournamentsData />
      </Suspense>
    </>
  );
}
