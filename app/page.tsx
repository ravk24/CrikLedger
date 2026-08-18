import { Suspense } from "react";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { TabBar } from "@/components/shared/TabBar";
import { PoolSummaryCard } from "@/components/dashboard/PoolSummaryCard";
import { PlayerGrid } from "@/components/dashboard/PlayerGrid";
import { InstallNudge } from "@/components/dashboard/InstallNudge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabasePublic } from "@/lib/supabase-public";
import { getCurrentTeam } from "@/lib/team";
import type { PlayerPublic } from "@/types";

async function DashboardData() {
  const team = await getCurrentTeam();
  const [poolRes, playersRes, countRes, lastMatchRes] = await Promise.all([
    supabasePublic
      .from("pool_balance")
      .select("balance")
      .eq("team_id", team.id)
      .single(),
    supabasePublic.from("players_public").select("*").eq("team_id", team.id),
    supabasePublic
      .from("pool_ledger_public")
      .select("*", { count: "exact", head: true })
      .eq("team_id", team.id),
    supabasePublic
      .from("pool_ledger_public")
      .select("amount")
      .eq("team_id", team.id)
      .eq("kind", "match_collection")
      // Explicit — the view's internal ORDER BY isn't guaranteed to
      // survive a filtered LIMIT pushdown. (created_at isn't exposed
      // by the view; entry_date is the best available key.)
      .order("entry_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
      <PoolSummaryCard
        balance={balance}
        entryCount={countRes.count ?? 0}
        lastCollection={lastCollection}
      />
      <InstallNudge />
      <PlayerGrid players={players} />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <Skeleton className="h-28 rounded-lg" />
      <Skeleton className="h-11 rounded-md" />
      <Skeleton className="h-64 rounded-lg" />
    </>
  );
}

export default function Dashboard() {
  return (
    <div className="min-h-svh bg-background pb-28">
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardData />
        </Suspense>
      </main>
      <TabBar />
    </div>
  );
}
