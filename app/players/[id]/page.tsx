import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Money } from "@/components/shared/Money";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CaptainMark } from "@/components/shared/CaptainMark";
import { ViceCaptainMark } from "@/components/shared/ViceCaptainMark";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StatementList,
  type StatementRow,
} from "@/components/players/StatementList";
import { getSessionAdmin } from "@/lib/session";
import { supabasePublic } from "@/lib/supabase-public";
import type { PlayerPublic } from "@/types";

async function StatementData({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [playerRes, statementRes, admin] = await Promise.all([
    supabasePublic.from("players_public").select("*").eq("id", id).maybeSingle(),
    supabasePublic
      .from("player_statement")
      .select("*")
      .eq("player_id", id)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),
    getSessionAdmin(),
  ]);

  const player = playerRes.data as PlayerPublic | null;
  if (!player) notFound();
  const rows = (statementRes.data ?? []) as StatementRow[];
  const canEdit = !!admin && !admin.mustChangePassword;

  return (
    <>
      <section className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Marks flow inline with the name so a wrapping name keeps them
              beside its last word instead of pushed against the balance. */}
          <h1 className="text-2xl font-bold text-text-primary">
            {player.name}
            {player.is_captain && <CaptainMark className="ml-2 align-middle" />}
            {player.is_vice_captain && (
              <ViceCaptainMark className="ml-2 align-middle" />
            )}
          </h1>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
            <StatusBadge status={player.status} />
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Balance
          </p>
          <Money
            amount={player.balance}
            variant="balance"
            className="text-2xl font-bold"
          />
        </div>
      </section>

      {!player.is_active && (
        <p className="rounded-lg bg-inactive-light px-4 py-2 text-sm text-inactive-foreground">
          This player has left the team — the history below stays forever.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
          No entries yet — deposits and match fees will appear here.
        </p>
      ) : (
        <StatementList rows={rows} canEdit={canEdit} />
      )}

      <p className="text-center text-xs text-text-muted">
        {rows.length} {rows.length === 1 ? "entry" : "entries"} · balances are
        derived live from the ledger
      </p>
    </>
  );
}

export default function PlayerStatement({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-svh bg-background pb-16">
      <header className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-md items-center gap-1 px-2 py-3">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-text-secondary"
          >
            <ChevronLeft size={18} />
            Players
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <Suspense
          fallback={
            <>
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-80 rounded-lg" />
            </>
          }
        >
          <StatementData params={params} />
        </Suspense>
      </main>
    </div>
  );
}
