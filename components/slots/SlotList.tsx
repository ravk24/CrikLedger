"use client";

import { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { CreditSheet } from "@/components/pool/CreditSheet";

type Props = {
  // ISO dates, ascending — already filtered to open future slots.
  dates: string[];
};

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Public read-only list of open ground dates; signed-in admins can tap
// a slot to schedule a match on it (which removes it from this page).
export function SlotList({ dates }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body?.success && !body.data.force_change) {
          setIsAdmin(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const byMonth = new Map<string, string[]>();
  for (const date of dates) {
    const key = monthLabel(date);
    byMonth.set(key, [...(byMonth.get(key) ?? []), date]);
  }

  if (dates.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
        No open slots left — every booked date has a match.
      </p>
    );
  }

  return (
    <>
      {[...byMonth.entries()].map(([month, monthDates]) => (
        <section key={month} className="flex flex-col gap-2">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
            {month}
          </h2>
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {monthDates.map((date) =>
              isAdmin ? (
                <button
                  key={date}
                  type="button"
                  onClick={() => setScheduleDate(date)}
                  className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <span className="text-sm font-medium text-text-primary">
                    {dayLabel(date)}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium text-accent">
                    <CalendarPlus size={14} />
                    Schedule
                  </span>
                </button>
              ) : (
                <div
                  key={date}
                  className="flex min-h-11 items-center px-4 py-3"
                >
                  <span className="text-sm font-medium text-text-primary">
                    {dayLabel(date)}
                  </span>
                </div>
              ),
            )}
          </div>
        </section>
      ))}

      {isAdmin && (
        <CreditSheet
          open={scheduleDate !== null}
          onOpenChange={(open) => !open && setScheduleDate(null)}
          players={[]}
          title="Schedule match"
          initialKind="ground_booking"
          lockKind
          initialSlotDate={scheduleDate ?? undefined}
        />
      )}
    </>
  );
}
