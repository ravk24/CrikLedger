import { Suspense } from "react";
import { notFound } from "next/navigation";
import { LedgerRow } from "@/components/shared/LedgerRow";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentLedgerSection } from "@/components/tournaments/TournamentLedgerSection";
import { getSessionAdmin } from "@/lib/session";
import { supabasePublic } from "@/lib/supabase-public";
import type { TournamentLedgerRow, TournamentPublic } from "@/types";

// The tournament mini-app's Ledger tab — the /pool analogue, scoped to
// this tournament's isolated ledger.
async function TournamentLedgerData({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, admin] = await Promise.all([params, getSessionAdmin()]);
  const isAdmin = !!admin && !admin.mustChangePassword;
  const [tRes, entriesRes] = await Promise.all([
    supabasePublic
      .from("tournaments_public")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabasePublic
      .from("tournament_ledger_public")
      .select("*")
      .eq("tournament_id", id),
  ]);

  const tournament = tRes.data as TournamentPublic | null;
  if (!tournament) notFound();
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
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
          {tournament.status === "completed"
            ? "The ledger is empty."
            : "The ledger is empty — deposits and shared expenses will appear here."}
        </p>
      ) : (
        <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
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
