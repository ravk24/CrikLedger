import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PlayerManager, type AdminPlayerRow } from "@/components/admin/PlayerManager";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionAdmin } from "@/lib/session";
import { pool } from "@/lib/db";
import { getCurrentTeamId } from "@/lib/team";

async function PlayersData() {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangePassword) redirect("/admin/password");

  const teamId = await getCurrentTeamId(pool);
  const res = await pool.query(
    `SELECT p.id, p.name, p.is_active, p.is_captain, p.is_vice_captain, b.balance
     FROM players p JOIN player_balances b ON b.id = p.id
     WHERE p.team_id = $1
     ORDER BY p.is_active DESC, p.name ASC`,
    [teamId],
  );
  const players: AdminPlayerRow[] = res.rows.map((row) => ({
    id: row.id,
    name: row.name,
    is_active: row.is_active,
    is_captain: row.is_captain,
    is_vice_captain: row.is_vice_captain,
    balance: Number(row.balance),
  }));

  const activeCount = players.filter((p) => p.is_active).length;

  return (
    <>
      <p className="text-sm text-text-secondary">
        {activeCount} active · {players.length - activeCount} left
      </p>
      <PlayerManager players={players} />
    </>
  );
}

export default function AdminPlayers() {
  return (
    <div className="min-h-svh bg-background pb-16">
      <header className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-md items-center gap-1 px-2 py-3">
          <Link
            href="/admin"
            className="flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-text-secondary"
          >
            <ChevronLeft size={18} />
            Console
          </Link>
          <h1 className="text-xl font-semibold text-text-primary">Players</h1>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
          <PlayersData />
        </Suspense>
      </main>
    </div>
  );
}
