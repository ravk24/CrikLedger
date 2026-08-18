import { Suspense } from "react";
import Link from "next/link";
import { pool } from "@/lib/db";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsHeader } from "@/components/ops/OpsHeader";
import { requireMegaadminPage } from "@/components/ops/guard";

async function OverviewData() {
  await requireMegaadminPage("/ops");

  const { rows } = await pool.query<{
    teams: string;
    accounts: string;
    memberships: string;
    tournaments: string;
    matches: string;
    stray: string;
  }>(`SELECT
        (SELECT count(*) FROM teams)                                   AS teams,
        (SELECT count(*) FROM admins)                                  AS accounts,
        (SELECT count(*) FROM team_memberships WHERE is_active)        AS memberships,
        (SELECT count(*) FROM tournaments)                             AS tournaments,
        (SELECT count(*) FROM matches)                                 AS matches,
        (SELECT count(*) FROM team_memberships m
           JOIN admins a ON a.id = m.admin_id
          WHERE a.platform_role = 'megaadmin')                         AS stray`);
  const c = rows[0];

  const tiles = [
    { label: "Teams", value: c.teams, href: "/ops/teams" },
    { label: "Accounts", value: c.accounts, href: "/ops/accounts" },
    { label: "Memberships", value: c.memberships, href: "/ops/accounts" },
    { label: "Tournaments", value: c.tournaments, href: null },
    { label: "Matches", value: c.matches, href: null },
  ];

  return (
    <>
      <OpsHeader />
      <h1 className="text-xl font-bold text-text-primary">Platform</h1>
      <section className="grid grid-cols-2 gap-3">
        {tiles.map((t) => {
          const inner = (
            <>
              <span className="text-2xl font-bold text-text-primary">
                {t.value}
              </span>
              <span className="text-xs font-medium text-text-secondary">
                {t.label}
              </span>
            </>
          );
          return t.href ? (
            <Link
              key={t.label}
              href={t.href}
              className="flex min-h-20 flex-col justify-center gap-0.5 rounded-lg border border-border bg-surface p-4"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={t.label}
              className="flex min-h-20 flex-col justify-center gap-0.5 rounded-lg border border-border bg-surface p-4"
            >
              {inner}
            </div>
          );
        })}
      </section>

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

      <section className="flex flex-col gap-2">
        <Link
          href="/ops/products"
          className="rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary"
        >
          Products &amp; pricing →
        </Link>
        <Link
          href="/ops/payments"
          className="rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary"
        >
          Payments →
        </Link>
      </section>
    </>
  );
}

export default function Ops() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
      <OverviewData />
    </Suspense>
  );
}
