"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { MatchWizard } from "@/components/wizard/MatchWizard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ScheduleMatchSheet } from "@/components/admin/ScheduleMatchSheet";
import { opponentLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WizardInitial, WizardPlayer } from "@/components/wizard/wizardTypes";

type Props = {
  matchId: string;
  opponent: string | null; // null = not known yet
  matchDate: string; // yyyy-mm-dd, for editing the schedule
  matchDateLabel: string;
  status: "scheduled" | "completed" | "abandoned";
  venue: string | null; // free-text ground name; null = none recorded
  // Linked ground booking's captain; null = no booking for this opponent.
  opponentCaptain: string | null;
  // Still-outstanding fee, from the match itself or a legacy booking.
  // Non-zero blocks completion until it is cleared.
  feePending: number;
  // Whole agreed fee (settled + pending) and its direction, for the
  // edit sheet's fee block.
  feeAmount: number;
  feeDirection: "credit" | "debit" | null;
  players: WizardPlayer[];
  isSuperadmin: boolean;
  initial?: WizardInitial; // present when status = completed
  // Pool-fronted ground fee, pre-fills the wizard's Costs step.
  initialGroundFee?: number;
};

export function MatchAdminActions({
  matchId,
  opponent,
  matchDate,
  matchDateLabel,
  status,
  venue,
  opponentCaptain,
  feePending,
  feeAmount,
  feeDirection,
  players,
  isSuperadmin,
  initial,
  initialGroundFee,
}: Props) {
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editScheduleOpen, setEditScheduleOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    try {
      const res = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not delete the match.");
        return;
      }
      // Delete only exists on completed matches, so back to that list.
      router.push("/schedule/completed");
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
      setConfirmDelete(false);
    }
  }

  const wizard = (
    <MatchWizard
      open={wizardOpen}
      onOpenChange={setWizardOpen}
      matchId={matchId}
      opponent={opponentLabel(opponent)}
      matchDateLabel={matchDateLabel}
      players={players}
      mode={status === "scheduled" ? "complete" : "edit"}
      groundLabel={venue ?? ""}
      initial={initial}
      initialGroundFee={initialGroundFee}
    />
  );

  // Keep the wizard mounted while its success pane is open — abandoning
  // refreshes the page into this state, and unmounting would destroy
  // the "ground fee returned" message before it can be read.
  if (status === "abandoned") return wizardOpen ? wizard : null;

  // Completion is locked until the opponent is known and the booking's
  // pending fee is cleared.
  const noOpponent = !opponent?.trim();
  const blocked = status === "scheduled" && (noOpponent || feePending > 0);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={blocked}
          onClick={() => {
            if (!blocked) setWizardOpen(true);
          }}
          className={cn(
            "h-11 flex-1 rounded-md text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
            status === "scheduled"
              ? "bg-credit text-white"
              : "bg-accent text-accent-foreground",
          )}
        >
          {status === "scheduled" ? "Complete match" : "Edit match"}
        </button>
        {status === "scheduled" && (
          <button
            type="button"
            onClick={() => setEditScheduleOpen(true)}
            className="h-11 rounded-md border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Edit
          </button>
        )}
        {status === "completed" && isSuperadmin && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="h-11 rounded-md border border-debit-light px-4 text-sm font-medium text-debit"
          >
            Delete
          </button>
        )}
      </div>
      {blocked && (
        <p className="text-xs text-text-muted">
          {noOpponent
            ? "Set the opponent (tap Edit) to enable match completion."
            : "Clear the pending match fee to enable match completion."}
        </p>
      )}
      {error && <p className="text-sm text-debit">{error}</p>}

      {status === "scheduled" && (
        <ScheduleMatchSheet
          open={editScheduleOpen}
          onOpenChange={setEditScheduleOpen}
          editing={{
            matchId,
            date: matchDate,
            opponent,
            opponentCaptain,
            venue,
            feeAmount,
            feeDirection,
            feePending,
          }}
        />
      )}

      {wizard}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this match?"
        description={
          feeDirection === "credit"
            ? "Superadmin only. All participant rows and the auto pool credit are removed, and the match fee credited to the pool is taken back out — every balance recalculates."
            : "Superadmin only. All participant rows and the auto pool credit are removed, and the pool-fronted match fee returns to the pool — every balance recalculates."
        }
        confirmLabel="Delete match"
        destructive
        pending={pending}
        onConfirm={handleDelete}
      />
    </section>
  );
}
