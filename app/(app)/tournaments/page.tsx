import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { CreateTournamentSheet } from "@/components/tournaments/CreateTournamentSheet";
import { TournamentPricingCurtain } from "@/components/tournaments/TournamentPricingCurtain";
import { HowPaymentWorks } from "@/components/shared/HowPaymentWorks";
import { ProductCard } from "@/components/shared/ProductCard";
import { TOURNAMENT } from "@/lib/products";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { getNavState, type NavState } from "@/lib/nav";
import { canWrite } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { pool } from "@/lib/db";
import { supabaseServer } from "@/lib/supabase-server";
import { getCurrentTeam } from "@/lib/team";
import type { TournamentPublic } from "@/types";

function CardList({ tournaments }: { tournaments: TournamentPublic[] }) {
  return (
    <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card">
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
type DirectoryRow = {
  id: string;
  name: string;
  status: string;
  host_name: string | null;
};

// Names and statuses only — no money — so this is one of the two reads
// the app caches. The tournament create / edit / delete routes
// revalidate the tag, so a new tournament shows on the next request;
// the lifetime is just a backstop.
async function loadDirectory(): Promise<DirectoryRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("tournament-directory");
  // The host's name rides along so other users see who is running
  // each tournament ("Ravi — LRPL"). admins.name is the same display
  // name already stamped on "edited by" rows, so nothing new is exposed.
  const { rows } = await pool.query(
    `SELECT t.id, t.name, t.status, a.name AS host_name
     FROM tournaments t
     LEFT JOIN admins a ON a.id = t.created_by
     ORDER BY t.created_at DESC
     LIMIT 50`,
  );
  return rows as DirectoryRow[];
}

function TournamentDirectory({
  hosted,
  all,
}: {
  hosted: boolean;
  all: DirectoryRow[];
}) {
  return (
    <>
      <Link
        href="/purchases"
        className="flex h-11 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground"
      >
        {hosted ? "Host a new tournament" : "Manage your tournament"}
      </Link>

      <TournamentPricingCurtain>
        <ProductCard product={TOURNAMENT} />
        <HowPaymentWorks />
      </TournamentPricingCurtain>

      {all.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface shadow-card p-4 text-sm text-text-muted">
          No tournaments have been hosted yet.
        </p>
      ) : (
        <>
          <h2 className="px-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            Hosted on CrikLedger
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card">
            {all.map((t) => (
              // Plain text, not a control: there is nothing to disable,
              // so no aria-disabled and no <Link>.
              <li
                key={t.id}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-text-muted opacity-60"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {t.host_name ? `${t.host_name} — ${t.name}` : t.name}
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
  // The directory needs nothing from the session, so the two reads run
  // together instead of session-then-directory; a credit holder simply
  // discards the (cached) directory.
  const [nav, directory] = await Promise.all([getNavState(), loadDirectory()]);
  if (!nav.hasTournamentCredit) {
    return <TournamentDirectory hosted={false} all={directory} />;
  }
  return <HostedTournaments nav={nav} />;
}

async function HostedTournaments({ nav }: { nav: NavState }) {
  const team = await getCurrentTeam();
  const [res, admin] = await Promise.all([
    supabaseServer
      .from("tournaments_public")
      .select("*")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false }),
    getSessionAdmin(),
  ]);
  const tournaments = (res.data ?? []) as TournamentPublic[];
  const active = tournaments.filter((t) => t.status === "active");
  const past = tournaments.filter((t) => t.status === "completed");
  const isAdmin =
    !!admin && !admin.mustChangePassword && canWrite(admin, "team", team.id);

  return (
    <>
      {isAdmin && <CreateTournamentSheet creditsLeft={nav.tournamentCreditsLeft} />}

      {tournaments.length === 0 && (
        <p className="rounded-lg border border-border bg-surface shadow-card p-4 text-sm text-text-muted">
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
      <h1 className="text-xl font-bold text-text-primary">Tournaments</h1>
      <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
        <TournamentsData />
      </Suspense>
    </>
  );
}
