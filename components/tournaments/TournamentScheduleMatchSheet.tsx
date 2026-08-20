"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SheetShell } from "@/components/shared/SheetShell";
import { resolveGroundInfo, type Ground } from "@/lib/grounds";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  venue: string | null; // ground comes from the tournament's Details
  grounds: Ground[]; // team ground list, for the canonical label
  // Present when fixing an already-scheduled match instead of creating.
  editing?: {
    matchId: string;
    opponent: string;
    date: string; // yyyy-mm-dd
    time: string; // HH:mm[:ss]
  };
};

const inputClass =
  "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

// Tournament match scheduling: opponent + date + TIME (required —
// tournaments run all day in slots). The ground is never entered here;
// it is auto-filled from the tournament's Details venue.
export function TournamentScheduleMatchSheet({
  open,
  onOpenChange,
  tournamentId,
  venue,
  grounds,
  editing,
}: Props) {
  const router = useRouter();
  const [opponent, setOpponent] = useState(editing?.opponent ?? "");
  const [date, setDate] = useState(editing?.date ?? "");
  const [time, setTime] = useState(editing?.time.slice(0, 5) ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const groundLabel = venue
    ? resolveGroundInfo("away", venue, grounds, null).label
    : null;

  const editOpponent = editing?.opponent;
  const editDate = editing?.date;
  const editTime = editing?.time;
  useEffect(() => {
    if (open && editing) {
      setOpponent(editOpponent ?? "");
      setDate(editDate ?? "");
      setTime(editTime?.slice(0, 5) ?? "");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editOpponent, editDate, editTime]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        editing
          ? `/api/tournaments/${tournamentId}/matches/${editing.matchId}/schedule`
          : `/api/tournaments/${tournamentId}/matches`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opponent: opponent.trim(),
            match_date: date,
            match_time: time,
          }),
        },
      );
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not save — try again.");
        return;
      }
      onOpenChange(false);
      if (!editing) {
        setOpponent("");
        setDate("");
        setTime("");
      }
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SheetShell
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setError(null); // no stale errors on reopen
      }}
      title={editing ? "Edit Schedule" : "Schedule Match"}
      description={
        editing
          ? "Fix the opponent, date or time — the card updates right away."
          : "The match appears on this tournament's Matches tab right away."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            Opponent Team Name
          </span>
          <input
            type="text"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="Falcons XI"
            required
            maxLength={80}
            className={inputClass}
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Time
            </span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className={inputClass}
            />
          </label>
        </div>
        <div className="rounded-md bg-surface-secondary px-3 py-2">
          <p className="text-xs font-medium text-text-secondary">Ground</p>
          <p className="text-sm text-text-primary">
            {groundLabel ?? "Not set — add the ground in Admin → Details"}
          </p>
        </div>
        {error && <p className="text-sm text-debit">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : editing
              ? "Save changes"
              : "Schedule match"}
        </button>
      </form>
    </SheetShell>
  );
}
