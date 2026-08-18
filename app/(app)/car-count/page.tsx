import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabasePublic } from "@/lib/supabase-public";
import { getCurrentTeam } from "@/lib/team";

// Derived, like every number in the app: a player's car count is the
// number of completed-match rows where they brought a car — no stored
// counter table.
async function CarCountData() {
  const team = await getCurrentTeam();
  const [playersRes, participantsRes] = await Promise.all([
    supabasePublic
      .from("players_public")
      .select("name, is_active")
      .eq("team_id", team.id)
      .eq("is_active", true)
      .order("name"),
    supabasePublic
      .from("match_participants_public")
      .select("player_name, brought_car")
      .eq("team_id", team.id),
  ]);

  const counts = new Map<string, number>();
  for (const row of (participantsRes.data ?? []) as {
    player_name: string;
    brought_car: boolean;
  }[]) {
    if (!row.brought_car) continue;
    counts.set(row.player_name, (counts.get(row.player_name) ?? 0) + 1);
  }

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
