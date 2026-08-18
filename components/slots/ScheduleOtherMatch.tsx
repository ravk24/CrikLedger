"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { OtherScheduleWizard } from "@/components/slots/OtherScheduleWizard";
import type { Ground } from "@/lib/grounds";

type Props = {
  grounds: Ground[]; // team ground list for the wizard's venue select
  // Standing captain for the paid-to-owner note in the wizard.
  captainName: string | null;
};

// Admin-only entry point for away scheduling: no pre-booked slot list
// exists for other grounds. Opens the two-step wizard — who received
// the ground fee, then date + opponent (+ ground name) + amount; the
// match and the pool debit are created in one transaction.
export function ScheduleOtherMatch({ grounds, captainName }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-accent-foreground"
      >
        <CalendarPlus size={16} />
        Schedule away match
      </button>
      <OtherScheduleWizard
        open={open}
        onOpenChange={setOpen}
        grounds={grounds}
        captainName={captainName}
      />
    </>
  );
}
