import { Suspense } from "react";
import { PoolSummaryCard } from "@/components/dashboard/PoolSummaryCard";
import { PlayerGrid } from "@/components/dashboard/PlayerGrid";
import { InstallNudge } from "@/components/dashboard/InstallNudge";
import { LedgerHowTo } from "@/components/dashboard/LedgerHowTo";
import { DownloadImageButton } from "@/components/shared/DownloadImageButton";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeIntro } from "@/components/install/HomeIntro";
import { pool } from "@/lib/db";
import { getNavState } from "@/lib/nav";
import { canWrite } from "@/lib/roles";
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
  // getSessionAdmin is React-cached and getCurrentTeam already ran it,
  // so this pair is one query, not two.
  const [team, admin] = await Promise.all([getCurrentTeam(), getSessionAdmin()]);
  // The captain-phone read used to run inside LedgerHowTo as a third
  // serial stage; it needs only team.id, so it rides this Promise.all.
  // Still superadmin-gated: phone is view-absent by design (migration 43).
  const wantsHowTo =
    !!admin && !admin.mustChangePassword && admin.activeTeamRole === "superadmin";
  const [poolRes, playersRes, countRes, lastMatchRes, phoneRes] = await Promise.all([
    supabaseServer
      .from("pool_balance")
      .select("balance")
      .eq("team_id", team.id)
      .single(),
    // Exactly the PlayerPublic columns — team_id would ride along ×30
    // rows into the RSC payload otherwise.
    supabaseServer
      .from("players_public")
      .select("id, name, is_active, balance, status, is_captain, is_vice_captain")
      .eq("team_id", team.id),
    // Count the base table, not the ledger view — the view's two LEFT
    // JOINs (admins, players) buy nothing for a COUNT.
    supabaseServer
      .from("pool_entries")
      .select("id", { count: "exact", head: true })
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
    wantsHowTo
      ? pool.query<{ phone: string | null }>(
          `SELECT phone FROM players WHERE team_id = $1 AND is_captain LIMIT 1`,
          [team.id],
        )
      : null,
  ]);

  const balance = Number(poolRes.data?.balance ?? 0);
  const captainPhone = phoneRes?.rows[0]?.phone ?? null;
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
      {/* Post-purchase checklist — computes its ✓s live and returns
          null once done (or for anyone who can't act on it). The
          tournament checklist lives on each tournament's Home tab. */}
      {wantsHowTo && (
        <LedgerHowTo players={players} captainPhone={captainPhone} />
      )}
      <PoolSummaryCard
        balance={balance}
        entryCount={countRes.count ?? 0}
        lastCollection={lastCollection}
      />
      <InstallNudge />
      <PlayerGrid
        players={players}
        downloadSlot={
          // The share image is admin-only server-side (requireTeamAdmin),
          // so the button is too: the team viewer reads, it does not post.
          admin && !admin.mustChangePassword && canWrite(admin, "team", team.id) ? (
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
