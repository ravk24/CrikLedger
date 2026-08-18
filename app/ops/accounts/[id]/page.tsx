import { Suspense } from "react";
import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsHeader } from "@/components/ops/OpsHeader";
import { requireMegaadminPage } from "@/components/ops/guard";
import { AccountActions } from "@/components/ops/AccountActions";

type Account = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  platform_role: string;
  is_active: boolean;
  must_change_password: boolean;
  session_epoch: number;
  created_at: string;
};

type Membership = {
  scope: string;
  name: string;
  role: string;
  is_active: boolean;
};

async function AccountData({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const self = await requireMegaadminPage(`/ops/accounts/${id}`);

  const [accRes, memRes] = await Promise.all([
    pool.query<Account>(
      `SELECT id, username, name, email, platform_role, is_active,
              must_change_password, session_epoch, created_at
         FROM admins WHERE id = $1`,
      [id],
    ),
    pool.query<Membership>(
      `SELECT 'team' AS scope, t.display_name AS name, m.team_role AS role, m.is_active
         FROM team_memberships m JOIN teams t ON t.id = m.team_id
        WHERE m.admin_id = $1
       UNION ALL
       SELECT 'tournament', tr.name, tm.tournament_role, tm.is_active
         FROM tournament_memberships tm
         JOIN tournaments tr ON tr.id = tm.tournament_id
        WHERE tm.admin_id = $1`,
      [id],
    ),
  ]);

  const account = accRes.rows[0];
  if (!account) notFound();

  return (
    <>
      <OpsHeader />
      <section className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
        <h1 className="text-lg font-bold text-text-primary">
          {account.username}
        </h1>
        <p className="text-sm text-text-secondary">{account.name}</p>
        <dl className="mt-2 space-y-1 text-xs text-text-secondary">
          <Row k="Email" v={account.email ?? "—"} />
          <Row k="Platform role" v={account.platform_role} />
          <Row k="Status" v={account.is_active ? "active" : "suspended"} />
          <Row
            k="Password"
            v={account.must_change_password ? "reset pending" : "set"}
          />
          <Row k="Session epoch" v={String(account.session_epoch)} />
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
          Memberships
        </h2>
        {memRes.rows.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
            None — this account owns and administers nothing.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {memRes.rows.map((m, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-text-primary">
                  {m.name}
                  <span className="ml-1.5 text-xs text-text-muted">
                    {m.scope}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-text-secondary">
                  {m.role}
                  {!m.is_active && " · revoked"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {account.platform_role === "megaadmin" && memRes.rows.length > 0 && (
          <p className="rounded-lg border border-debit bg-surface p-3 text-xs text-debit">
            A platform account must hold no memberships.
          </p>
        )}
      </section>

      <AccountActions
        accountId={account.id}
        username={account.username}
        isActive={account.is_active}
        isSelf={account.id === self.id}
      />
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{k}</dt>
      <dd className="text-text-primary">{v}</dd>
    </div>
  );
}

export default function OpsAccount({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
      <AccountData params={params} />
    </Suspense>
  );
}
