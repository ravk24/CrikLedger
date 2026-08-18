"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SheetShell } from "@/components/shared/SheetShell";
import {
  GroundSelect,
  OTHER_GROUND,
  venueToSelection,
} from "@/components/shared/GroundSelect";
import type { Ground } from "@/lib/grounds";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grounds: Ground[]; // team ground list for the venue select
  // Present when fixing an already-scheduled match instead of creating one.
  // opponentCaptain comes from the linked ground booking; null = no booking,
  // so there is no captain record to edit.
  editing?: {
    matchId: string;
    date: string;
    opponent: string;
    opponentCaptain: string | null;
    ground: "barne" | "other";
    venue: string | null;
  };
  // Create mode only: pre-fill the date (e.g. scheduling from a slot).
  // Creation here is always a Barne match — away matches go through
  // OtherScheduleWizard, which also records the ground-fee debit.
  initialDate?: string;
};

export function ScheduleMatchSheet({
  open,
  onOpenChange,
  grounds,
  editing,
  initialDate,
}: Props) {
  const router = useRouter();
  const [date, setDate] = useState(editing?.date ?? initialDate ?? "");
  const [opponent, setOpponent] = useState(editing?.opponent ?? "");
  const [captain, setCaptain] = useState(editing?.opponentCaptain ?? "");
  const initialSelection = venueToSelection(grounds, editing?.venue);
  const [groundChoice, setGroundChoice] = useState(initialSelection.choice);
  const [customName, setCustomName] = useState(initialSelection.customName);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Only booking matches carry an opponent captain to edit.
  const hasCaptainField = editing?.opponentCaptain != null;
  // Venue only exists on Other (away) matches.
  const hasVenueField = editing?.ground === "other";

  const editDate = editing?.date;
  const editOpponent = editing?.opponent;
  const editCaptain = editing?.opponentCaptain;
  const editVenue = editing?.venue;
  useEffect(() => {
    if (open && editDate !== undefined && editOpponent !== undefined) {
      setDate(editDate);
      setOpponent(editOpponent);
      setCaptain(editCaptain ?? "");
      const selection = venueToSelection(grounds, editVenue);
      setGroundChoice(selection.choice);
      setCustomName(selection.customName);
      setError(null);
    } else if (open && editDate === undefined && initialDate !== undefined) {
      setDate(initialDate);
      setError(null);
    }
  }, [open, editDate, editOpponent, editCaptain, editVenue, initialDate, grounds]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const venue =
      groundChoice === OTHER_GROUND ? customName.trim() : groundChoice;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        editing ? `/api/matches/${editing.matchId}/schedule` : "/api/matches",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            match_date: date,
            opponent: opponent.trim(),
            ...(hasVenueField && venue ? { venue } : {}),
            ...(hasCaptainField && captain.trim()
              ? { opponent_captain: captain.trim() }
              : {}),
          }),
        },
      );
      const body = await res.json();
      if (!body.success) {
        setError(
          body.error?.message ??
            (editing ? "Could not save — try again." : "Could not schedule — try again."),
        );
        return;
      }
      onOpenChange(false);
      if (!editing) {
        setDate("");
        setOpponent("");
      }
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit schedule" : "Schedule match"}
      description={
        editing
          ? "Fix the date, opponent or captain — the public card updates right away."
          : "The card appears publicly on the matches page right away."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            Match date
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            Opponent
          </span>
          <input
            type="text"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="Borivali Blasters"
            required
            className={inputClass}
          />
        </label>
        {hasVenueField && (
          <GroundSelect
            grounds={grounds}
            choice={groundChoice}
            customName={customName}
            onChoiceChange={setGroundChoice}
            onCustomNameChange={setCustomName}
          />
        )}
        {hasCaptainField && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Opponent Captain
            </span>
            <input
              type="text"
              value={captain}
              onChange={(e) => setCaptain(e.target.value)}
              required
              className={inputClass}
            />
          </label>
        )}
        {error && <p className="text-sm text-debit">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending
            ? editing
              ? "Saving…"
              : "Scheduling…"
            : editing
              ? "Save changes"
              : "Schedule match"}
        </button>
      </form>
    </SheetShell>
  );
}
