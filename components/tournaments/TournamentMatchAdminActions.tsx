"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MatchWizard } from "@/components/wizard/MatchWizard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TournamentScheduleMatchSheet } from "@/components/tournaments/TournamentScheduleMatchSheet";
import { cn } from "@/lib/utils";
import type { Ground, GroundInfo } from "@/lib/grounds";
import type { WizardInitial, WizardPlayer } from "@/components/wizard/wizardTypes";

type Props = {
  tournamentId: string;
  matchId: string;
  opponent: string;
  matchDate: string; // yyyy-mm-dd
  matchTime: string; // HH:mm[:ss]
  matchDateLabel: string;
  status: "scheduled" | "completed" | "abandoned";
  venue: string | null; // tournament venue — drives the car-fee prefill
  grounds: Ground[]; // team ground list for the schedule sheet's label
  groundInfo: GroundInfo; // resolved server-side for the wizard prefill
  players: WizardPlayer[];
  isSuperadmin: boolean;
  initial?: WizardInitial; // present when status = completed
};

// Sibling of the SG MatchAdminActions without the booking gate, the SG
// schedule sheet, or the SG endpoints. Rendered only when the
// tournament is ACTIVE (completed tournament = read-only pages).
export function TournamentMatchAdminActions({
  tournamentId,
  matchId,
  opponent,
  matchDate,
  matchTime,
  matchDateLabel,
  status,
  venue,
  grounds,
  groundInfo,
  players,
  isSuperadmin,
  initial,
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
      const res = await fetch(
        `/api/tournaments/${tournamentId}/matches/${matchId}`,
        { method: "DELETE" },
      );
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not delete the match.");
        return;
      }
      router.push(`/tournaments/${tournamentId}/matches`);
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
      apiBase={`/api/tournaments/${tournamentId}/matches/${matchId}`}
      hasGuests={false}
      // No sharing question here: tournament car money keeps splitting
      // across everyone in the match (engine/tournamentFee.ts).
      hasSharing={false}
      hasCosts={false}
      hasPreview={false}
      fundLabel="fund"
    />
  );

  if (status === "abandoned") {
    // Keep the wizard mounted while its success pane is open — the
    // abandon refresh lands here and must not destroy the message.
    if (!isSuperadmin) return wizardOpen ? wizard : null;
    return (
      <section className="flex flex-col gap-2">
        {wizardOpen && wizard}
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="h-11 rounded-md border border-debit-light px-4 text-sm font-medium text-debit"
        >
          Delete Match
        </button>
        {error && <p className="text-sm text-debit">{error}</p>}
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this match?"
          description="Superadmin only. The abandoned match is removed — it never charged any fees."
          confirmLabel="Delete match"
          destructive
          pending={pending}
          onConfirm={handleDelete}
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className={cn(
            "h-11 flex-1 rounded-md text-sm font-medium",
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
        {isSuperadmin && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="h-11 rounded-md border border-debit-light px-4 text-sm font-medium text-debit"
          >
            Delete
          </button>
        )}
      </div>
      {error && <p className="text-sm text-debit">{error}</p>}

      {status === "scheduled" && (
        <TournamentScheduleMatchSheet
          open={editScheduleOpen}
          onOpenChange={setEditScheduleOpen}
          tournamentId={tournamentId}
          venue={venue}
          grounds={grounds}
          editing={{
            matchId,
            opponent,
            date: matchDate,
            time: matchTime,
          }}
        />
      )}

      {wizard}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this match?"
        description="Superadmin only. The match and its attendance are removed — the tournament fee re-splits across the remaining matches when you mark the tournament completed."
        confirmLabel="Delete match"
        destructive
        pending={pending}
        onConfirm={handleDelete}
      />
    </section>
  );
}
