import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Shield } from "lucide-react";
import { pool } from "@/lib/db";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsHeader } from "@/components/ops/OpsHeader";
import { requireMegaadminPage } from "@/components/ops/guard";

type Row = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  platform_role: string;
  is_active: boolean;
  teams: string;
  created_at: string;
};

async function AccountsData() {
  await requireMegaadminPage("/ops/accounts");

  const { rows } = await pool.query<Row>(
    `SELECT a.id, a.username, a.name, a.email, a.platform_role, a.is_active,
            (SELECT count(*) FROM team_memberships m
              WHERE m.admin_id = a.id AND m.is_active) AS teams,
            a.created_at
       FROM admins a
      ORDER BY a.created_at`,
  );

  return (
    <>
      <OpsHeader />
      <h1 className="text-xl font-bold text-text-primary">Accounts</h1>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {rows.map((a) => (
        <li key={a.id}>
          <Link
            href={`/ops/accounts/${a.id}`}
            className="flex items-center gap-3 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-text-primary">
                {a.platform_role === "megaadmin" && (
                  <Shield size={13} className="shrink-0" />
                )}
                {a.username}
                {!a.is_active && (
                  <span className="shrink-0 text-[11px] font-medium text-debit">
                    suspended
                  </span>
                )}
              </p>
              <p className="mt-0.5 truncate text-xs text-text-muted">
                {a.email ?? "no email"} · {a.teams} team(s)
              </p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-text-muted" />
          </Link>
        </li>
      ))}
      </ul>
    </>
  );
}

export default function OpsAccounts() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
      <AccountsData />
    </Suspense>
  );
}
