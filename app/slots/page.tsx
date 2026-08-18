import { Suspense } from "react";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { TabBar } from "@/components/shared/TabBar";
import { SlotList } from "@/components/slots/SlotList";
import { Skeleton } from "@/components/ui/skeleton";
import { todayIST } from "@/lib/format";
import { GROUND_SLOTS } from "@/lib/groundSlots";
import { supabasePublic } from "@/lib/supabase-public";
import { getCurrentTeam } from "@/lib/team";

async function SlotsData() {
  const team = await getCurrentTeam();
  // Only Barne matches consume Barne slot dates — an away match on a
  // slot Saturday leaves the Barne ground free.
  const matchesRes = await supabasePublic
    .from("matches_public")
    .select("match_date")
    .eq("team_id", team.id)
    .eq("ground", "barne");

  // Any Barne match on a date consumes the ground day; past unscheduled
  // slots are wasted, not available.
  const used = new Set(
    (matchesRes.data ?? []).map((m) =>
      String(m.match_date as string).slice(0, 10),
    ),
  );
  // IST "today" — the UTC server would otherwise show yesterday's slot
  // as available between 00:00 and 05:30 IST.
  const todayISO = todayIST();
  const available = GROUND_SLOTS.filter(
    (date) => !used.has(date) && date >= todayISO,
  );

  return (
    <>
      <p className="text-sm text-text-secondary">
        {available.length} of {GROUND_SLOTS.length} booked slots still open —
        an admin can schedule a match on any of them.
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
        <div>
          <h1 className="text-xl font-bold text-text-primary">
            Home Matches
          </h1>
          <p className="mt-0.5 text-xs text-text-muted">
            Ground booked Sat–Sun · Nov 2026 – May 2027
          </p>
        </div>
        <Suspense
          fallback={
            <>
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
