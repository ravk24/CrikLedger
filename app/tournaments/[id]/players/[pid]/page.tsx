import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Money } from "@/components/shared/Money";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentBackLink } from "@/components/tournaments/TournamentBackLink";
import {
  StatementRow,
  type FeeDetail,
} from "@/components/tournaments/TournamentStatementRow";
import { AccessGate } from "@/components/shared/AccessGate";
import type { Verdict } from "@/lib/access";
import { canRead } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import type {
  TournamentFeeBreakdownRow,
  TournamentFeeChargePublic,
  TournamentPlayerPublic,
  TournamentStatementRow,
} from "@/types";
import { CHROME_HEADER } from "@/lib/ui";

// Read-only tournament player statement. Edits happen from the
// tournament ledger, so no admin affordances here (unlike the
// the team-ledger StatementList, which this deliberately does not reuse —
// that component couples to /api/pool/entries and match links).
// A statement grows for as long as the tournament runs; read newest
// first, a page at a time, like /players/[id].
const PAGE_SIZE = 50;

async function StatementData({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pid: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ id: tournamentId, pid: playerId }, { page: raw }] = await Promise.all([
    params,
    searchParams,
  ]);
  const page = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const [tRes, admin, playerRes, rowsRes, chargeRes, breakdownRes] = await Promise.all([
    supabaseServer
      .from("tournaments_public")
      .select("id, team_id")
      .eq("id", tournamentId)
      .maybeSingle(),
    getSessionAdmin(),
    supabaseServer
      .from("tournament_players_public")
      .select("*")
      .eq("id", playerId)
      .eq("tournament_id", tournamentId)
      .maybeSingle(),
    // One row past the page answers "is there more?".
    supabaseServer
      .from("tournament_player_statement")
      .select("*")
      .eq("player_id", playerId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE),
    supabaseServer
      .from("tournament_fee_charges_public")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("player_id", playerId)
      .maybeSingle(),
    supabaseServer
      .from("tournament_fee_breakdown_public")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("player_id", playerId)
      .order("match_date", { ascending: true })
      .order("match_time", { ascending: true }),
  ]);

  const tournament = tRes.data as { id: string; team_id: string | null } | null;
  if (!tournament) notFound();

  // A player's balance and full statement are private data. Rights come
  // from the tournament's own scope — its hosting team, or the tournament
  // itself when a Tournament-Credit buyer owns no team — the same rule the
  // Admin tab applies. This page used to have no check at all.
  const scopeKind = tournament.team_id ? "team" : "tournament";
  const scopeId = tournament.team_id ?? tournament.id;
  const verdict: Verdict = !admin
    ? { ok: false, reason: "anonymous" }
    : canRead(admin, scopeKind, scopeId)
      ? { ok: true, teamId: scopeId, via: admin.platformRole === "megaadmin" ? "megaadmin" : "member" }
      : { ok: false, reason: "forbidden" };
  if (!verdict.ok) {
    return (
      <AccessGate
        verdict={verdict}
        what="this player's statement"
        next={`/tournaments/${tournamentId}/players/${playerId}`}
      />
    );
  }

  const player = playerRes.data as TournamentPlayerPublic | null;
  if (!player) notFound();
  const fetched = (rowsRes.data ?? []) as TournamentStatementRow[];
  const hasMore = fetched.length > PAGE_SIZE;
  const rows = hasMore ? fetched.slice(0, PAGE_SIZE) : fetched;
  const shown = from + rows.length;

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
        <p className="rounded-lg border border-border bg-surface shadow-card p-4 text-sm text-text-muted">
          No entries yet — deposits, expense shares and the tournament fee will
          appear here.
        </p>
      ) : (
        <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card">
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

      {hasMore && (
        <Link
          href={`/tournaments/${tournamentId}/players/${playerId}?page=${page + 1}`}
          className="flex h-11 items-center justify-center rounded-md border border-border bg-surface shadow-card text-sm font-medium text-text-primary"
        >
          Show older entries
        </Link>
      )}

      <p className="text-center text-xs text-text-muted">
        {hasMore
          ? `Showing the latest ${shown} entries`
          : `${shown} ${shown === 1 ? "entry" : "entries"}`}{" "}
        · balances are derived live from the tournament ledger
      </p>
    </>
  );
}

export default function TournamentPlayerStatement({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pid: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  return (
    <div className="min-h-svh bg-background pb-16">
      <header className={CHROME_HEADER}>
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
          <StatementData params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
