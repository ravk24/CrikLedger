"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { CreditSheet } from "@/components/pool/CreditSheet";

// Opens the pool-credit ground-booking form: one submit records the
// booking, credits the paid amount to the pool, and schedules a match
// per booked slot. (Plain date+opponent scheduling still exists on the
// slots page and when editing a scheduled match.)
export function ScheduleMatchTile() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface p-4 text-left text-text-primary"
      >
        <span className="flex size-9 items-center justify-center rounded-md bg-accent-light text-accent">
          <CalendarPlus size={18} />
        </span>
        <span className="text-sm font-semibold">Schedule match</span>
      </button>
      <CreditSheet
        open={open}
        onOpenChange={setOpen}
        players={[]}
        title="Schedule match"
        initialKind="ground_booking"
        lockKind
      />
    </>
  );
}
