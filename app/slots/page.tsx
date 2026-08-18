import { Suspense } from "react";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { TabBar } from "@/components/shared/TabBar";
import { SlotList } from "@/components/slots/SlotList";
import { Skeleton } from "@/components/ui/skeleton";
import { todayIST } from "@/lib/format";
import { supabasePublic } from "@/lib/supabase-public";
import { getCurrentTeam, getTeamSlots } from "@/lib/team";

function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

async function SlotsData() {
  const team = await getCurrentTeam();
  const slots = await getTeamSlots(team.id);
  // Only home matches consume home slot dates — an away match on a
  // slot Saturday leaves the home ground free.
  const matchesRes = await supabasePublic
    .from("matches_public")
    .select("match_date")
    .eq("team_id", team.id)
    .eq("ground", "home");

  // Any home match on a date consumes the ground day; past unscheduled
  // slots are wasted, not available.
  const used = new Set(
    (matchesRes.data ?? []).map((m) =>
      String(m.match_date as string).slice(0, 10),
    ),
  );
  // IST "today" — the UTC server would otherwise show yesterday's slot
  // as available between 00:00 and 05:30 IST.
  const todayISO = todayIST();
  const available = slots
    .map((s) => s.slot_date)
    .filter((date) => !used.has(date) && date >= todayISO);

  const season = slots[0] ?? null;

  return (
    <>
      <p className="-mt-3 text-xs text-text-muted">
        {season
          ? `${season.season_label} · ${monthYear(season.starts_on)} – ${monthYear(season.ends_on)}`
          : "No season slots configured yet."}
      </p>
      <p className="text-sm text-text-secondary">
        {available.length} of {slots.length} booked slots still open — an
        admin can schedule a match on any of them.
      </p>
      <SlotList dates={available} />
    </>
  );
}

export default function AvailableSlots() {
  return (
    <div className="min-h-svh bg-background pb-28">
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <h1 className="text-xl font-bold text-text-primary">Home Matches</h1>
        <Suspense
          fallback={
            <>
              <Skeleton className="-mt-3 h-4 w-48 rounded" />
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-64 rounded-lg" />
            </>
          }
        >
          <SlotsData />
        </Suspense>
      </main>
      <TabBar />
    </div>
  );
}
