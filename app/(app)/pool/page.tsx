import { Suspense } from "react";
import Link from "next/link";
import { LedgerRow } from "@/components/shared/LedgerRow";
import { LedgerFilter } from "@/components/pool/LedgerFilter";
import { LedgerEmptyFiltered } from "@/components/pool/LedgerEmptyFiltered";
import { PoolAdminSection } from "@/components/pool/PoolAdminSection";
import { Skeleton } from "@/components/ui/skeleton";
import { DemoLedger } from "@/components/guest/DemoLedger";
import { getNavState } from "@/lib/nav";
import {
  ledgerFilterDef,
  parseLedgerFilter,
  type LedgerFilter as LedgerFilterValue,
} from "@/lib/poolKinds";
import { canWrite } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import { getCurrentTeam } from "@/lib/team";
import type { PlayerPublic, PoolLedgerRow } from "@/types";

// The ledger is append-only and grows every match, so it is read a page
// at a time: newest first, "Show older entries" steps back. The view no
// longer orders itself (migration 40) — the order lives here.
const PAGE_SIZE = 50;

type PoolSearchParams = { page?: string; kind?: string };

async function LedgerData({
  searchParams,
}: {
  searchParams: Promise<PoolSearchParams>;
}) {
  // Read inside the Suspense hole, like the cookies — a dynamic read in
  // the page body would cost the static shell under cacheComponents.
  const { page: raw, kind } = await searchParams;
  const page = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
  const filter = parseLedgerFilter(kind);
  const nav = await getNavState();
  // No Team Ledger: a worked sample from hardcoded fixtures, never a
  // real team's money.
  if (!nav.hasTeamLedger) return <DemoLedger />;
  return <PoolLedgerData page={page} filter={filter} />;
}

async function PoolLedgerData({
  page,
  filter,
}: {
  page: number;
  filter: LedgerFilterValue;
}) {
  const team = await getCurrentTeam();
  const from = (page - 1) * PAGE_SIZE;
  const def = ledgerFilterDef(filter);
  // The kind filter runs here, not in the browser: the list is paged,
  // so a client-side filter would miss older pages. `(team_id, kind,
  // entry_date, created_at)` is indexed (migration 45); the match-fee
  // filter keys on the view's match link instead of a kind.
  let query = supabaseServer
    .from("pool_ledger_public")
    .select("*")
    .eq("team_id", team.id);
  if (def.kinds) query = query.in("kind", [...def.kinds]);
  if (def.matchLinked === true) query = query.not("match_id", "is", null);
  if (def.matchLinked === false) query = query.is("match_id", null);
  // The players list only matters to a signed-in admin, but it costs
  // nothing to fetch alongside the ledger instead of after it.
  // One row past the page answers "is there more?" — no COUNT(*) over
  // the whole ledger on every visit.
  const [entriesRes, admin, playersRes] = await Promise.all([
    query
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
  const kindParam = filter === "all" ? "" : `&kind=${filter}`;
  const olderLink = hasMore ? (
    <Link
      href={`/pool?page=${page + 1}${kindParam}`}
      className="flex h-11 items-center justify-center rounded-md border border-border bg-surface shadow-card text-sm font-medium text-text-primary"
    >
      Show older entries
    </Link>
  ) : null;

  // A session alone is not a writer: the team viewer (migration 49) and
  // the megaadmin observer both read this page and get the plain list.
  const canEdit =
    !!admin && !admin.mustChangePassword && canWrite(admin, "team", team.id);

  // Viewers and the megaadmin have no toolbar: the funnel sits alone,
  // right-aligned, where the admin's toolbar would be.
  const filterControl = (
    <div className="flex justify-end">
      <LedgerFilter value={filter} />
    </div>
  );

  if (entries.length === 0 && !canEdit) {
    return (
      <>
        {filterControl}
        {filter === "all" ? (
          <p className="rounded-lg border border-border bg-surface shadow-card p-4 text-sm text-text-muted">
            The ledger is empty — deposits and match collections will appear here.
          </p>
        ) : (
          <LedgerEmptyFiltered label={def.label} />
        )}
      </>
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
          activeFilter={filter}
        />
        {olderLink}
      </>
    );
  }

  return (
    <>
      {filterControl}
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
  searchParams: Promise<PoolSearchParams>;
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
