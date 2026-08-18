"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MatchWizard } from "@/components/wizard/MatchWizard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ScheduleMatchSheet } from "@/components/admin/ScheduleMatchSheet";
import { cn } from "@/lib/utils";
import type { Ground, GroundInfo } from "@/lib/grounds";
import type { WizardInitial, WizardPlayer } from "@/components/wizard/wizardTypes";

type Props = {
  matchId: string;
  opponent: string;
  matchDate: string; // yyyy-mm-dd, for editing the schedule
  matchDateLabel: string;
  status: "scheduled" | "completed" | "abandoned";
  ground: "home" | "away";
  venue: string | null; // away ground name, away matches only
  grounds: Ground[]; // team ground list for the edit-schedule select
  groundInfo: GroundInfo; // resolved server-side for the wizard prefill
  // Linked ground booking's captain; null = no booking for this opponent.
  opponentCaptain: string | null;
  // Linked booking's pending fee; 0 = fully paid or no booking.
  feePending: number;
  players: WizardPlayer[];
  isSuperadmin: boolean;
  initial?: WizardInitial; // present when status = completed
  // Away matches: pool-fronted ground fee, pre-fills the wizard's Costs step.
  initialGroundFee?: number;
};

export function MatchAdminActions({
  matchId,
  opponent,
  matchDate,
  matchDateLabel,
  status,
  ground,
  venue,
  grounds,
  groundInfo,
  opponentCaptain,
  feePending,
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
      router.push("/matches");
      router.refresh();
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
      opponent={opponent}
      matchDateLabel={matchDateLabel}
      players={players}
      mode={status === "scheduled" ? "complete" : "edit"}
      groundInfo={groundInfo}
      initial={initial}
      initialGroundFee={initialGroundFee}
    />
  );

  // Keep the wizard mounted while its success pane is open — abandoning
  // refreshes the page into this state, and unmounting would destroy
  // the "ground fee returned" message before it can be read.
  if (status === "abandoned") return wizardOpen ? wizard : null;

  // Completion is locked until the booking's pending fee is cleared.
  const blocked = status === "scheduled" && feePending > 0;

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
          Clear the pending match fee to enable match completion.
        </p>
      )}
      {error && <p className="text-sm text-debit">{error}</p>}

      {status === "scheduled" && (
        <ScheduleMatchSheet
          open={editScheduleOpen}
          onOpenChange={setEditScheduleOpen}
          grounds={grounds}
          editing={{
            matchId,
            date: matchDate,
            opponent,
            opponentCaptain,
            ground,
            venue,
          }}
        />
      )}

      {wizard}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this match?"
        description={
          ground === "away"
            ? "Superadmin only. All participant rows and the auto pool credit are removed, and the pool-fronted ground fee returns to the pool — every balance recalculates."
            : "Superadmin only. All participant rows and the auto pool credit are removed, and a booking match's share of the booking credit is deducted from the pool — every balance recalculates."
        }
        confirmLabel="Delete match"
        destructive
        pending={pending}
        onConfirm={handleDelete}
      />
    </section>
  );
}
