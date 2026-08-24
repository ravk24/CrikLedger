import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Swords } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentScheduleMatch } from "@/components/tournaments/TournamentScheduleMatch";
import { canWrite } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";
import type { TournamentPublic } from "@/types";

// Copied from app/(app)/schedule/page.tsx so the two hubs cannot drift.
const TILE_CLASS =
  "flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface shadow-card p-4 text-left text-text-primary";
const ACTION_CLASS =
  "col-span-2 flex min-h-16 w-full flex-row items-center gap-3 rounded-lg border border-border bg-surface shadow-card p-4 text-left text-text-primary";

// The tournament Schedule hub — the SG /schedule analogue: one action
// tile that opens the scheduling sheet, two link tiles to the lists.
async function TournamentScheduleData({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, admin] = await Promise.all([params, getSessionAdmin()]);
  const signedInAdmin = !!admin && !admin.mustChangePassword;
  const tRes = await supabaseServer
    .from("tournaments_public")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const tournament = tRes.data as TournamentPublic | null;
  if (!tournament) notFound();

  // Rights come from this tournament's own scope — its hosting team, or
  // the tournament itself for a standalone purchase.
  const isAdmin =
    signedInAdmin &&
    (tournament.team_id
      ? canWrite(admin, "team", tournament.team_id)
      : canWrite(admin, "tournament", tournament.id));
  const canSchedule = isAdmin && tournament.status === "active";

  const options = [
    {
      label: "Scheduled",
      href: `/tournaments/${id}/schedule/upcoming`,
      icon: Swords,
      iconClass: "bg-accent-light text-accent",
    },
    {
      label: "Completed",
      href: `/tournaments/${id}/schedule/completed`,
      icon: CheckCircle2,
      iconClass: "bg-credit-light text-credit-foreground",
    },
  ];

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Schedule</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          See what&apos;s coming up, or put a new match on the calendar.
        </p>
      </div>

      {tournament.status === "completed" && (
        <p className="rounded-lg bg-inactive-light px-4 py-2 text-sm text-inactive-foreground">
          This tournament is completed — matches are read-only.
        </p>
      )}

      <section className="grid grid-cols-2 gap-3">
        <TournamentScheduleMatch
          canSchedule={canSchedule}
          tileClass={ACTION_CLASS}
          tournamentId={id}
          venue={tournament.venue}
        />
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <Link key={option.href} href={option.href} className={TILE_CLASS}>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-md",
                  option.iconClass,
                )}
              >
                <Icon size={18} />
              </span>
              <span className="text-sm font-semibold">{option.label}</span>
            </Link>
          );
        })}
      </section>
    </>
  );
}

export default function TournamentSchedule({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-svh bg-background pb-28">
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
          <TournamentScheduleData params={params} />
        </Suspense>
      </main>
    </div>
  );
}
