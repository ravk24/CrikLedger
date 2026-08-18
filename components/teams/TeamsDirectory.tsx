import Link from "next/link";
import { Users } from "lucide-react";
import { supabasePublic } from "@/lib/supabase-public";
import type { NavState } from "@/lib/nav";

type TeamRow = { id: string; slug: string; display_name: string };

// Every team using CricLedger. Titles are visible to everyone; rows are
// greyed and inert unless you are a member — the app-wide
// disabled-not-hidden rule.
//
// Selects only the title columns ON PURPOSE: teams_public also exposes
// status_threshold, car_rate_per_km, meeting_point and is_sandbox, none
// of which a directory needs and none of which a stranger should get.
export async function TeamsDirectory({ nav }: { nav: NavState }) {
  const { data } = await supabasePublic
    .from("teams_public")
    .select("id, slug, display_name")
    .order("display_name");

  const teams = (data ?? []) as TeamRow[];
  const mine = new Set(nav.teams.map((t) => t.id));

  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">Teams</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          {teams.length} team{teams.length === 1 ? "" : "s"} run their ledger
          on CricLedger.
        </p>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {teams.map((team) => {
          const isMine = mine.has(team.id);
          const inner = (
            <>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                <Users size={17} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {team.display_name}
              </span>
              {isMine && (
                <span className="shrink-0 rounded-full bg-scheduled-light px-2 py-0.5 text-[11px] font-medium text-scheduled-foreground">
                  Your team
                </span>
              )}
            </>
          );
          const className =
            "flex min-h-14 items-center gap-3 px-4 py-3 text-text-primary";

          return isMine ? (
            <li key={team.id}>
              <Link href="/" className={className}>
                {inner}
              </Link>
            </li>
          ) : (
            // Not aria-disabled: the row is plain text, not a control,
            // and there is nothing to disable. The sr-only note is what
            // carries "you cannot open this" to a screen reader.
            <li key={team.id} className={`${className} text-text-muted opacity-60`}>
              {inner}
              <span className="sr-only">(not your team)</span>
            </li>
          );
        })}
      </ul>

      {!nav.signedIn && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">
            Run your own team&apos;s ledger
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Match fees, car allowances and the pool — worked out for you
            after every game.
          </p>
          <Link
            href="/signup"
            className="mt-3 flex h-11 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground"
          >
            Get started
          </Link>
        </div>
      )}
    </>
  );
}
