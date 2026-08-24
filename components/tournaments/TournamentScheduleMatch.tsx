"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { TournamentScheduleMatchSheet } from "@/components/tournaments/TournamentScheduleMatchSheet";
import { cn } from "@/lib/utils";

type Props = {
  // Server-resolved: scope-aware admin AND an active tournament. False
  // renders the tile dimmed and inert rather than hiding it — the
  // app-wide disabled-not-hidden rule.
  canSchedule: boolean;
  // The hub's shared tile shape, so this button and its sibling links
  // cannot drift apart.
  tileClass: string;
  tournamentId: string;
  venue: string | null; // read-only Ground line in the sheet
};

// The tournament Schedule tab's first card — sibling of the SG
// ScheduleMatch tile, opening the opponent/date/time sheet in place
// instead of navigating.
export function TournamentScheduleMatch({
  canSchedule,
  tileClass,
  tournamentId,
  venue,
}: Props) {
  const [open, setOpen] = useState(false);

  const face = (
    <>
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-md",
          "bg-scheduled-light text-scheduled-foreground",
        )}
      >
        <CalendarPlus size={18} />
      </span>
      <span className="text-sm font-semibold">Schedule a Match</span>
    </>
  );

  if (!canSchedule) {
    return (
      <div aria-disabled className={cn(tileClass, "opacity-50")}>
        {face}
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={tileClass}>
        {face}
      </button>
      <TournamentScheduleMatchSheet
        open={open}
        onOpenChange={setOpen}
        tournamentId={tournamentId}
        venue={venue}
      />
    </>
  );
}
