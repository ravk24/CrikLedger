import { Suspense } from "react";
import { notFound } from "next/navigation";
import { LedgerRow } from "@/components/shared/LedgerRow";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentLedgerSection } from "@/components/tournaments/TournamentLedgerSection";
// aliased: this file already has a local `canWrite` meaning
// "the tournament is still active".
import { canWrite as canWriteScope } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import type { TournamentLedgerRow, TournamentPublic } from "@/types";

// The tournament mini-app's Ledger tab — the /pool analogue, scoped to
// this tournament's isolated ledger.
async function TournamentLedgerData({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, admin] = await Promise.all([params, getSessionAdmin()]);
  const signedInAdmin = !!admin && !admin.mustChangePassword;
  const [tRes, entriesRes] = await Promise.all([
    supabaseServer
      .from("tournaments_public")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabaseServer
      .from("tournament_ledger_public")
      .select("*")
      .eq("tournament_id", id)
      // The view no longer orders itself (migration 40).
      .order("entry_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
  ]);

  const tournament = tRes.data as TournamentPublic | null;
  if (!tournament) notFound();

  // Rights come from this tournament's own scope — its hosting team, or
  // the tournament itself for a standalone purchase. Being an admin of
  // some other team grants nothing here, and the megaadmin reads but
  // never writes (canWrite refuses it).
  const isAdmin =
    signedInAdmin &&
    (tournament.team_id
      ? canWriteScope(admin, "team", tournament.team_id)
      : canWriteScope(admin, "tournament", tournament.id));
  const entries = (entriesRes.data ?? []) as TournamentLedgerRow[];
  const canWrite = isAdmin && tournament.status === "active";

  return (
    <>
      <h1 className="text-xl font-semibold text-text-primary">Ledger</h1>

      {tournament.status === "completed" && (
        <p className="rounded-lg bg-inactive-light px-4 py-2 text-sm text-inactive-foreground">
          This tournament is completed — the ledger is read-only.
        </p>
      )}

      {canWrite ? (
        <TournamentLedgerSection tournamentId={id} entries={entries} />
      ) : entries.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface shadow-card p-4 text-sm text-text-muted">
          {tournament.status === "completed"
            ? "The ledger is empty."
            : "The ledger is empty — deposits and shared expenses will appear here."}
        </p>
      ) : (
        <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          {entries.map((entry) => (
            <LedgerRow key={entry.id} entry={entry} />
          ))}
        </section>
      )}

    </>
  );
}

export default function TournamentLedger({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-svh bg-background pb-28">
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
          <TournamentLedgerData params={params} />
        </Suspense>
      </main>
    </div>
  );
}
