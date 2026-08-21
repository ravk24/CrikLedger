"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { ScheduleMatchWizard } from "@/components/schedule/ScheduleMatchWizard";

type Props = {
  // Standing captain for the paid-to-owner note in the wizard.
  captainName: string | null;
};

// Admin-only entry point for scheduling. Opens the two-step wizard —
// who received the ground fee, then date + opponent (+ ground name) +
// amount; the match and the pool debit are created in one transaction.
export function ScheduleMatch({ captainName }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-accent-foreground"
      >
        <CalendarPlus size={16} />
        Schedule match
      </button>
      <ScheduleMatchWizard
        open={open}
        onOpenChange={setOpen}
        captainName={captainName}
      />
    </>
  );
}
