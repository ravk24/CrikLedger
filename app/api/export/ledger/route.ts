import { connection } from "next/server";
import { pool } from "@/lib/db";
import { handleRouteError } from "@/lib/validate";
import { requireTeamAdmin } from "@/lib/session";
import { getTeamById } from "@/lib/team";
import { todayIST } from "@/lib/format";
import { buildLedgerWorkbook } from "@/lib/export/ledgerWorkbook";
import {
  LEDGER_CAP,
  STATEMENT_CAP,
  exportFilename,
  exportedAtLabel,
  shapeStatements,
  sortBalances,
  withRunningBalance,
  type BalanceSource,
  type LedgerSource,
  type StatementSource,
} from "@/lib/export/ledgerRows";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// The whole team ledger as one workbook — Ledger, Balances, Statements —
// for an admin to keep or hand to whoever audits the season. Admin-only
// because a ledger is team-private; reads the DB itself, nothing about
// the rows comes from the client.
//
// Reads go through pg rather than supabase-js: PostgREST caps a request
// at 1000 rows whatever .range() asks for, and an export is whole-history
// by definition. Dates are cast to text in SQL so node-postgres never
// turns a tz-less DATE into a local-midnight Date.
export async function GET() {
  // Per-request by nature (session cookie); this keeps the build's
  // prerender pass from reaching the try/catch below.
  await connection();
  try {
    const admin = await requireTeamAdmin();
    const team = await getTeamById(admin.scopeId);

    const [ledgerRes, playersRes, statementRes, balanceRes] =
      await Promise.all([
        pool.query<LedgerSource>(
          `SELECT id, entry_date::text AS entry_date, created_at::text AS created_at,
                  kind, message, amount, player_name, edited_by,
                  match_id, match_opponent
             FROM pool_ledger_public
            WHERE team_id = $1
            ORDER BY entry_date, created_at, id
            LIMIT $2`,
          [team.id, LEDGER_CAP + 1],
        ),
        pool.query<BalanceSource>(
          `SELECT id, name, is_active, balance, status, is_captain, is_vice_captain
             FROM players_public
            WHERE team_id = $1
            ORDER BY name`,
          [team.id],
        ),
        pool.query<StatementSource>(
          `SELECT player_id, entry_date::text AS entry_date, created_at::text AS created_at,
                  kind, description, delta, running_balance, match_id, source_id, edited_by
             FROM player_statement
            WHERE team_id = $1
            ORDER BY player_id, entry_date, created_at, source_id
            LIMIT $2`,
          [team.id, STATEMENT_CAP + 1],
        ),
        pool.query<{ balance: number | string | null }>(
          `SELECT balance FROM pool_balance WHERE team_id = $1`,
          [team.id],
        ),
      ]);

    // One row past each cap says "there was more" without a COUNT(*).
    const ledgerTruncated = ledgerRes.rows.length > LEDGER_CAP;
    const statementsTruncated = statementRes.rows.length > STATEMENT_CAP;
    const ledgerRows = ledgerTruncated
      ? ledgerRes.rows.slice(0, LEDGER_CAP)
      : ledgerRes.rows;
    const statementRows = statementsTruncated
      ? statementRes.rows.slice(0, STATEMENT_CAP)
      : statementRes.rows;

    const playersById = new Map(playersRes.rows.map((p) => [p.id, p.name]));
    const bytes = await buildLedgerWorkbook({
      title: `${team.display_name} — Team ledger`,
      exportedAtLabel: exportedAtLabel(new Date()),
      fundLabel: "Pool balance",
      fundBalance: Number(balanceRes.rows[0]?.balance ?? 0),
      ledger: withRunningBalance(ledgerRows).rows,
      balances: sortBalances(playersRes.rows),
      statements: shapeStatements(statementRows, playersById),
      truncated: { ledger: ledgerTruncated, statements: statementsTruncated },
    });

    const filename = exportFilename(team.slug, todayIST());
    return new Response(bytes, {
      headers: {
        "Content-Type": XLSX_TYPE,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleRouteError("[export/ledger]", e);
  }
}
