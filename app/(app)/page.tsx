import { Suspense } from "react";
import { PoolSummaryCard } from "@/components/dashboard/PoolSummaryCard";
import { PlayerGrid } from "@/components/dashboard/PlayerGrid";
import { InstallNudge } from "@/components/dashboard/InstallNudge";
import { LedgerHowTo } from "@/components/dashboard/LedgerHowTo";
import { TournamentHowTo } from "@/components/dashboard/TournamentHowTo";
import { DownloadImageButton } from "@/components/shared/DownloadImageButton";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeIntro } from "@/components/install/HomeIntro";
import { getNavState } from "@/lib/nav";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import { getCurrentTeam } from "@/lib/team";
import type { PlayerPublic } from "@/types";

// Slot 0 of the tab bar. Same href and same "Home" label for everyone;
// what it RENDERS is what changes on purchase — the welcome-and-install
// page for a visitor, this team's dashboard for a Ledger holder.
// Keeping the href stable is why no bookmark or manifest start_url ever
// breaks.
async function HomeData() {
  const nav = await getNavState();
  if (!nav.hasTeamLedger) return <HomeIntro nav={nav} />;
  return <DashboardData />;
}

async function DashboardData() {
  const team = await getCurrentTeam();
  const [poolRes, playersRes, countRes, lastMatchRes, admin] = await Promise.all([
    supabaseServer
      .from("pool_balance")
      .select("balance")
      .eq("team_id", team.id)
      .single(),
    supabaseServer.from("players_public").select("*").eq("team_id", team.id),
    supabaseServer
      .from("pool_ledger_public")
      .select("*", { count: "exact", head: true })
      .eq("team_id", team.id),
    supabaseServer
      .from("pool_ledger_public")
      .select("amount")
      .eq("team_id", team.id)
      .eq("kind", "match_collection")
      // Explicit — the view's internal ORDER BY isn't guaranteed to
      // survive a filtered LIMIT pushdown. created_at breaks
      // same-day ties (migration 42).
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getSessionAdmin(),
  ]);

  const balance = Number(poolRes.data?.balance ?? 0);
  const players = (playersRes.data ?? []) as PlayerPublic[];
  // Lowest balance first (biggest debtors on top), inactive at the end;
  // names only break ties.
  players.sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    if (Number(a.balance) !== Number(b.balance))
      return Number(a.balance) - Number(b.balance);
    return a.name.localeCompare(b.name);
  });
  const lastCollection = lastMatchRes.data
    ? Number(lastMatchRes.data.amount)
    : null;

  return (
    <>
      <section className="rounded-lg border border-border bg-surface p-3 text-center shadow-card">
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
          Team
        </p>
        <p className="truncate text-lg font-bold text-text-primary">
          {team.display_name}
        </p>
      </section>
      {/* Post-purchase checklists — each computes its ✓s live and
          returns null once done (or for anyone who can't act on it). */}
      <LedgerHowTo team={team} players={players} admin={admin} />
      <TournamentHowTo />
      <PoolSummaryCard
        balance={balance}
        entryCount={countRes.count ?? 0}
        lastCollection={lastCollection}
      />
      <InstallNudge />
      <PlayerGrid
        players={players}
        downloadSlot={
          admin && !admin.mustChangePassword ? (
            <DownloadImageButton
              endpoint="/api/share/balances"
              filename="player-balances.png"
              title="Player balances"
            />
          ) : null
        }
      />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <Skeleton className="h-16 rounded-lg" />
      <Skeleton className="h-28 rounded-lg" />
      <Skeleton className="h-11 rounded-md" />
      <Skeleton className="h-64 rounded-lg" />
    </>
  );
}

export default function Dashboard() {
  return (
    <>
      {/* The branch lives INSIDE the Suspense boundary: it reads
          cookies, and a dynamic read in the page body fails the build
          under cacheComponents. */}
      <Suspense fallback={<DashboardSkeleton />}>
        <HomeData />
      </Suspense>
    </>
  );
}
