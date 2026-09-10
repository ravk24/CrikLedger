"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { ScheduleMatchWizard } from "@/components/schedule/ScheduleMatchWizard";
import type { TeamGround } from "@/lib/grounds";
import { cn } from "@/lib/utils";

type Props = {
  // Server-resolved: may this visitor schedule a match? False renders
  // the tile dimmed and inert rather than hiding it — the app-wide
  // disabled-not-hidden rule, and it keeps the grid from reflowing.
  canSchedule: boolean;
  // The hub's shared tile shape, so this button and its sibling links
  // cannot drift apart.
  tileClass: string;
  // The team's ground presets for the wizard's dropdown ([] = free text).
  grounds: TeamGround[];
};

// The Schedule tab's first card. Unlike its siblings it opens the
// wizard in place instead of navigating — scheduling is a modal, not a
// destination.
export function ScheduleMatch({ canSchedule, tileClass, grounds }: Props) {
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
      <ScheduleMatchWizard
        open={open}
        onOpenChange={setOpen}
        grounds={grounds}
      />
    </>
  );
}
