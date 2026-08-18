import { Suspense } from "react";
import { LedgerRow } from "@/components/shared/LedgerRow";
import { TabBar } from "@/components/shared/TabBar";
import { PoolAdminSection } from "@/components/pool/PoolAdminSection";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionAdmin } from "@/lib/session";
import { supabasePublic } from "@/lib/supabase-public";
import { getCurrentTeam } from "@/lib/team";
import type { PlayerPublic, PoolLedgerRow } from "@/types";

async function PoolLedgerData() {
  const team = await getCurrentTeam();
  const [entriesRes, admin] = await Promise.all([
    supabasePublic.from("pool_ledger_public").select("*").eq("team_id", team.id),
    getSessionAdmin(),
  ]);
  const entries = (entriesRes.data ?? []) as PoolLedgerRow[];

  if (entries.length === 0 && !admin) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
        The ledger is empty — deposits and match collections will appear here.
      </p>
    );
  }

  if (admin && !admin.mustChangePassword) {
    const { data: playersData } = await supabasePublic
      .from("players_public")
      .select("id, name, is_active")
      .eq("team_id", team.id)
      .eq("is_active", true)
      .order("name");
    const players = (playersData ?? []) as Pick<
      PlayerPublic,
      "id" | "name" | "is_active"
    >[];
    return (
      <PoolAdminSection
        entries={entries}
        players={players.map((p) => ({ id: p.id, name: p.name }))}
        activePlayerCount={players.length}
      />
    );
  }

  return (
    <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {entries.map((entry) => (
        <LedgerRow key={entry.id} entry={entry} />
      ))}
    </section>
  );
}

export default function Pool() {
  return (
    <div className="min-h-svh bg-background pb-28">
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <h1 className="text-xl font-semibold text-text-primary">Ledger</h1>
        <Suspense
          fallback={
            <>
              <Skeleton className="h-64 rounded-lg" />
            </>
          }
        >
          <PoolLedgerData />
        </Suspense>
      </main>
      <TabBar />
    </div>
  );
}
