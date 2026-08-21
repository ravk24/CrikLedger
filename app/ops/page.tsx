import { Suspense } from "react";
import { pool } from "@/lib/db";
import { LEDGER, TOURNAMENT } from "@/lib/products";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsChrome } from "@/components/ops/OpsChrome";
import { OpsConsole, type GrantRow, type OpsStats } from "@/components/ops/OpsConsole";
import { requireMegaadminPage } from "@/components/ops/guard";

// The whole operator console is this one page: three tiles (Ledger
// users, Tournament users, Statistics), each a sheet. Holder lists are
// grouped per purchaser + team, newest first; rows deep-link to the
// account page, which keeps reset-password / suspend / restore.
const HOLDERS_SQL = `
  SELECT a.id AS account_id, a.username, a.name, t.display_name AS team_name,
         min(e.created_at) AS first_at,
         count(*)::int AS total,
         count(e.consumed_at)::int AS used
    FROM entitlements e
    JOIN admins a ON a.id = e.admin_id
    JOIN teams  t ON t.id = e.team_id
   WHERE e.product = $1
   GROUP BY a.id, a.username, a.name, t.display_name
   ORDER BY min(e.created_at) DESC`;

async function ConsoleData() {
  await requireMegaadminPage("/ops");

  const [ledgerRes, tournamentRes, statsRes] = await Promise.all([
    pool.query<GrantRow>(HOLDERS_SQL, ["team_ledger"]),
    pool.query<GrantRow>(HOLDERS_SQL, ["tournament_credit"]),
    pool.query<{
      credits: string;
      ledger_users: string;
      superadmins: string;
      admins: string;
      money: string | null;
      stray: string;
    }>(`SELECT
          (SELECT count(*) FROM entitlements WHERE product = 'tournament_credit') AS credits,
          (SELECT count(*) FROM entitlements WHERE product = 'team_ledger')       AS ledger_users,
          (SELECT count(DISTINCT m.admin_id) FROM team_memberships m
             JOIN admins a ON a.id = m.admin_id
            WHERE m.team_role = 'superadmin' AND m.is_active
              AND a.platform_role <> 'megaadmin')                                 AS superadmins,
          (SELECT count(*) FROM team_memberships
            WHERE team_role = 'admin' AND is_active)                              AS admins,
          (SELECT sum(price_inr) FROM entitlements)                               AS money,
          (SELECT count(*) FROM team_memberships m
             JOIN admins a ON a.id = m.admin_id
            WHERE a.platform_role = 'megaadmin')                                  AS stray`),
  ]);
  const c = statsRes.rows[0];
  const stats: OpsStats = {
    credits: Number(c.credits),
    ledger_users: Number(c.ledger_users),
    superadmins: Number(c.superadmins),
    admins: Number(c.admins),
    money: Number(c.money ?? 0),
  };

  return (
    <OpsChrome>
      <OpsConsole
        ledger={ledgerRes.rows}
        tournament={tournamentRes.rows}
        stats={stats}
        prices={{
          team_ledger: LEDGER.priceInr,
          tournament_credit: TOURNAMENT.priceInr,
        }}
      />

      {/* The megaadmin must hold no membership — it is enforced in the
          membership routes and lib/roles.ts, not by a DB constraint (a
          CHECK cannot span tables and this repo has no triggers), so it
          is surfaced here instead of going unnoticed. */}
      {Number(c.stray) > 0 && (
        <p className="rounded-lg border border-debit bg-surface p-4 text-sm text-debit">
          {c.stray} membership row(s) belong to a platform account. The
          megaadmin must hold none — investigate before it grants anything.
        </p>
      )}
    </OpsChrome>
  );
}

export default function Ops() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </main>
      }
    >
      <ConsoleData />
    </Suspense>
  );
}
