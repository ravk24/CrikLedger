import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Money } from "@/components/shared/Money";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentBackLink } from "@/components/tournaments/TournamentBackLink";
import {
  StatementRow,
  type FeeDetail,
} from "@/components/tournaments/TournamentStatementRow";
import { supabasePublic } from "@/lib/supabase-public";
import type {
  TournamentFeeBreakdownRow,
  TournamentFeeChargePublic,
  TournamentPlayerPublic,
  TournamentStatementRow,
} from "@/types";

// Read-only tournament player statement. Edits happen from the
// tournament ledger, so no admin affordances here (unlike the
// the team-ledger StatementList, which this deliberately does not reuse —
// that component couples to /api/pool/entries and match links).
async function StatementData({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const { id: tournamentId, pid: playerId } = await params;
  const [playerRes, rowsRes, chargeRes, breakdownRes] = await Promise.all([
    supabasePublic
      .from("tournament_players_public")
      .select("*")
      .eq("id", playerId)
      .eq("tournament_id", tournamentId)
      .maybeSingle(),
    supabasePublic
      .from("tournament_player_statement")
      .select("*")
      .eq("player_id", playerId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabasePublic
      .from("tournament_fee_charges_public")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("player_id", playerId)
      .maybeSingle(),
    supabasePublic
      .from("tournament_fee_breakdown_public")
      .select("*")
      .eq("player_id", playerId)
      .order("match_date", { ascending: true })
      .order("match_time", { ascending: true }),
  ]);

  const player = playerRes.data as TournamentPlayerPublic | null;
  if (!player) notFound();
  const rows = (rowsRes.data ?? []) as TournamentStatementRow[];

  // The settlement's persisted per-match lines (migration-25) — each
  // match has its own rate, so the panel reads the stored share and
  // driver credit per match; nothing is recovered from the totals.
  // Pre-25 settlements have a charge but no lines: matches stays
  // empty and the panel renders totals only.
  const charge = chargeRes.data as TournamentFeeChargePublic | null;
  const feeDetail: FeeDetail | undefined = charge
    ? {
        played: charge.played,
        driverCredit: Number(charge.driver_credit),
        settledAt: charge.created_at,
        matches: ((breakdownRes.data ?? []) as TournamentFeeBreakdownRow[]).map(
          (b) => ({
            matchId: b.match_id,
            matchDate: b.match_date,
            opponent: b.opponent,
            share: Number(b.share),
            driverCredit: Number(b.driver_credit),
          }),
        ),
      }
    : undefined;

  return (
    <>
      <section className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-text-primary">{player.name}</h1>
          {!player.is_active && (
            <p className="mt-0.5 text-xs text-text-muted">
              Removed from the tournament — history stays.
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Balance
          </p>
          <Money
            amount={Number(player.balance)}
            variant="balance"
            className="text-2xl font-bold"
          />
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
          No entries yet — deposits, expense shares and the tournament fee will
          appear here.
        </p>
      ) : (
        <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {rows.map((row) => (
            <StatementRow
              key={row.source_id}
              row={{
                ...row,
                delta: Number(row.delta),
                running_balance: Number(row.running_balance),
              }}
              feeDetail={row.kind === "tournament_fee" ? feeDetail : undefined}
            />
          ))}
        </section>
      )}

      <p className="text-center text-xs text-text-muted">
        {rows.length} {rows.length === 1 ? "entry" : "entries"} · balances are
        derived live from the tournament ledger
      </p>
    </>
  );
}

export default function TournamentPlayerStatement({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  return (
    <div className="min-h-svh bg-background pb-16">
      <header className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-md items-center gap-1 px-2 py-3">
          <TournamentBackLink label="Tournament" />
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
