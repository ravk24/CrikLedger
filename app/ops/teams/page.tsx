import { Suspense } from "react";
import { pool } from "@/lib/db";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupees } from "@/lib/format";
import { OpsHeader } from "@/components/ops/OpsHeader";
import { requireMegaadminPage } from "@/components/ops/guard";

type Row = {
  id: string;
  slug: string;
  display_name: string;
  owner: string | null;
  admins: string;
  players: string;
  matches: string;
  balance: string | null;
  created_at: string;
};

async function TeamsData() {
  await requireMegaadminPage("/ops/teams");

  const { rows } = await pool.query<Row>(
    `SELECT t.id, t.slug, t.display_name,
            o.username AS owner,
            (SELECT count(*) FROM team_memberships m
              WHERE m.team_id = t.id AND m.is_active)          AS admins,
            (SELECT count(*) FROM players p WHERE p.team_id = t.id) AS players,
            (SELECT count(*) FROM matches x WHERE x.team_id = t.id) AS matches,
            (SELECT COALESCE(sum(amount), 0) FROM pool_entries e
              WHERE e.team_id = t.id)                          AS balance,
            t.created_at
       FROM teams t
       LEFT JOIN admins o ON o.id = t.owner_admin_id
      ORDER BY t.created_at`,
  );

  return (
    <>
      <OpsHeader />
      <h1 className="text-xl font-bold text-text-primary">Teams</h1>
      <ul className="flex flex-col gap-3">
      {rows.map((t) => (
        <li
          key={t.id}
          className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-text-primary">
              {t.display_name}
            </span>
            <span className="text-xs text-text-muted">/{t.slug}</span>
          </div>
          <p className="text-xs text-text-secondary">
            Owner: {t.owner ?? <span className="text-debit">none</span>}
          </p>
          <p className="text-xs text-text-secondary">
            {t.admins} member(s) · {t.players} players · {t.matches} matches ·
            pool ₹{formatRupees(Number(t.balance ?? 0))}
          </p>
        </li>
      ))}
      {rows.length === 0 && (
        <li className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
          No teams yet.
        </li>
      )}
      </ul>
    </>
  );
}

export default function OpsTeams() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
      <TeamsData />
    </Suspense>
  );
}
