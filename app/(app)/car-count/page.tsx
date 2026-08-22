import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabaseServer } from "@/lib/supabase-server";
import { AccessGate } from "@/components/shared/AccessGate";
import { checkActiveTeamRead } from "@/lib/access";
import { getCurrentTeam } from "@/lib/team";

// Derived, like every number in the app: a player's car count is the
// number of completed-match rows where they brought a car — no stored
// counter table.
async function CarCountData() {
  // Team data needs a session whose membership matches. Renders a panel
  // rather than throwing — a member who is merely signed out should see
  // "sign in", not a broken page.
  const verdict = await checkActiveTeamRead();
  if (!verdict.ok) {
    return <AccessGate verdict={verdict} what="the car counter" next="/car-count" />;
  }
  const team = await getCurrentTeam();
  const [playersRes, participantsRes] = await Promise.all([
    supabaseServer
      .from("players_public")
      .select("name, is_active")
      .eq("team_id", team.id)
      .eq("is_active", true)
      .order("name"),
    supabaseServer
      .from("player_car_counts")
      .select("player_name, car_count")
      .eq("team_id", team.id),
  ]);

  const counts = new Map(
    (
      (participantsRes.data ?? []) as {
        player_name: string;
        car_count: number;
      }[]
    ).map((r) => [r.player_name, r.car_count]),
  );

  const players = ((playersRes.data ?? []) as { name: string }[])
    .map((p) => ({ name: p.name, count: counts.get(p.name) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  if (players.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
        No active players yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-surface">
      {players.map((player) => (
        <div
          key={player.name}
          className="flex items-center justify-between px-4 py-3"
        >
          <span className="text-sm font-semibold text-text-primary">
            {player.name}
          </span>
          <span
            className={cn(
              "min-w-8 rounded-md px-2 py-0.5 text-center text-sm font-bold tabular-nums",
              player.count > 0
                ? "bg-scheduled-light text-scheduled-foreground"
                : "bg-surface-secondary text-text-muted",
            )}
          >
            {player.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CarCount() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">Car Counter</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Times each player brought their car to a match.
        </p>
      </div>
      <Suspense
        fallback={
          <>
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </>
        }
      >
        <CarCountData />
      </Suspense>
    </>
  );
}
