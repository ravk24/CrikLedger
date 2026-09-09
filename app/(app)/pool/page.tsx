import { Suspense } from "react";
import Link from "next/link";
import { LedgerRow } from "@/components/shared/LedgerRow";
import { PoolAdminSection } from "@/components/pool/PoolAdminSection";
import { Skeleton } from "@/components/ui/skeleton";
import { DemoLedger } from "@/components/guest/DemoLedger";
import { getNavState } from "@/lib/nav";
import { canWrite } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import { getCurrentTeam } from "@/lib/team";
import type { PlayerPublic, PoolLedgerRow } from "@/types";

// The ledger is append-only and grows every match, so it is read a page
// at a time: newest first, "Show older entries" steps back. The view no
// longer orders itself (migration 40) — the order lives here.
const PAGE_SIZE = 50;

async function LedgerData({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // Read inside the Suspense hole, like the cookies — a dynamic read in
  // the page body would cost the static shell under cacheComponents.
  const { page: raw } = await searchParams;
  const page = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
  const nav = await getNavState();
  // No Team Ledger: a worked sample from hardcoded fixtures, never a
  // real team's money.
  if (!nav.hasTeamLedger) return <DemoLedger />;
  return <PoolLedgerData page={page} />;
}

async function PoolLedgerData({ page }: { page: number }) {
  const team = await getCurrentTeam();
  const from = (page - 1) * PAGE_SIZE;
  // The players list only matters to a signed-in admin, but it costs
  // nothing to fetch alongside the ledger instead of after it.
  // One row past the page answers "is there more?" — no COUNT(*) over
  // the whole ledger on every visit.
  const [entriesRes, admin, playersRes] = await Promise.all([
    supabaseServer
      .from("pool_ledger_public")
      .select("*")
      .eq("team_id", team.id)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE),
    getSessionAdmin(),
    supabaseServer
      .from("players_public")
      .select("id, name, is_active")
      .eq("team_id", team.id)
      .eq("is_active", true)
      .order("name"),
  ]);
  const fetched = (entriesRes.data ?? []) as PoolLedgerRow[];
  const hasMore = fetched.length > PAGE_SIZE;
  const entries = hasMore ? fetched.slice(0, PAGE_SIZE) : fetched;
  const olderLink = hasMore ? (
    <Link
      href={`/pool?page=${page + 1}`}
      className="flex h-11 items-center justify-center rounded-md border border-border bg-surface shadow-card text-sm font-medium text-text-primary"
    >
      Show older entries
    </Link>
  ) : null;

  // A session alone is not a writer: the team viewer (migration 49) and
  // the megaadmin observer both read this page and get the plain list.
  const canEdit =
    !!admin && !admin.mustChangePassword && canWrite(admin, "team", team.id);

  if (entries.length === 0 && !canEdit) {
    return (
      <p className="rounded-lg border border-border bg-surface shadow-card p-4 text-sm text-text-muted">
        The ledger is empty — deposits and match collections will appear here.
      </p>
    );
  }

  if (canEdit) {
    const players = (playersRes.data ?? []) as Pick<
      PlayerPublic,
      "id" | "name" | "is_active"
    >[];
    return (
      <>
        <PoolAdminSection
          entries={entries}
          players={players.map((p) => ({ id: p.id, name: p.name }))}
          activePlayerCount={players.length}
          teamSlug={team.slug}
        />
        {olderLink}
      </>
    );
  }

  return (
    <>
      <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {entries.map((entry) => (
          <LedgerRow key={entry.id} entry={entry} />
        ))}
      </section>
      {olderLink}
    </>
  );
}

export default function Pool({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  return (
    <>
      <Suspense
        fallback={
          <>
            <Skeleton className="h-64 rounded-lg" />
          </>
        }
      >
        <LedgerData searchParams={searchParams} />
      </Suspense>
    </>
  );
}
