"use client";

import { startTransition, useOptimistic, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  FileText,
  Flag,
  MinusCircle,
  PlusCircle,
  Users,
} from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { SheetShell } from "@/components/shared/SheetShell";
import { CaptainMark } from "@/components/shared/CaptainMark";
import { ViceCaptainMark } from "@/components/shared/ViceCaptainMark";
import { TournamentDepositSheet } from "@/components/tournaments/TournamentDepositSheet";
import { TournamentScheduleMatchSheet } from "@/components/tournaments/TournamentScheduleMatchSheet";
import { TournamentExpenseSheet } from "@/components/tournaments/TournamentExpenseSheet";
import { TournamentCaptainTile } from "@/components/tournaments/TournamentCaptainTile";
import { TournamentViceCaptainTile } from "@/components/tournaments/TournamentViceCaptainTile";
import { cn } from "@/lib/utils";
import type { TournamentPlayerPublic, TournamentPublic } from "@/types";

type Props = {
  tournament: TournamentPublic;
  players: TournamentPlayerPublic[]; // full roster, active + removed
  isSuperadmin: boolean;
};

const inputClass =
  "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

// SG-console tile idioms (app/admin/page.tsx).
const tileClass =
  "flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface p-4 text-left text-text-primary disabled:cursor-not-allowed disabled:text-text-muted disabled:opacity-70";

// The tournament's Admin console tab: SG-style card grid (money entry
// lives HERE, not on the Ledger tab — Ravi 2026-08-15), then details
// and lifecycle. The page gates this to admins.
export function TournamentAdminPanel({
  tournament,
  players,
  isSuperadmin,
}: Props) {
  const router = useRouter();
  // Complete/Reopen flips the whole panel between editable and locked.
  // The flip shows at once and is reconciled by the refresh that follows
  // the write; on failure React drops the optimistic value by itself.
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    tournament.status,
  );
  const readOnly = optimisticStatus === "completed";
  const activePlayers = players.filter((p) => p.is_active);

  const [depositOpen, setDepositOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [name, setName] = useState(tournament.name);
  const [teamName, setTeamName] = useState(tournament.team_name ?? "");
  const [joiningFee, setJoiningFee] = useState(
    Number(tournament.joining_fee) > 0
      ? String(Math.round(Number(tournament.joining_fee)))
      : "",
  );
  const [venue, setVenue] = useState(tournament.venue ?? "");
  const [startDate, setStartDate] = useState(tournament.start_date ?? "");
  const [endDate, setEndDate] = useState(tournament.end_date ?? "");
  const [newName, setNewName] = useState("");
  const [removing, setRemoving] = useState<TournamentPlayerPublic | null>(null);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function callApi(path: string, init?: RequestInit) {
    const res = await fetch(path, init);
    const body = await res.json();
    if (!body.success) {
      throw new Error(body.error?.message ?? "Something went wrong — try again.");
    }
    return body.data;
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    const groundName = venue.trim();
    if (isSuperadmin && !(Number(joiningFee) > 0)) {
      setDetailsError("Enter the joining fee — it cannot be blank.");
      return;
    }
    setPending(true);
    setDetailsError(null);
    setDetailsSaved(false);
    try {
      await callApi(`/api/tournaments/${tournament.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          team_name: teamName.trim() === "" ? null : teamName.trim(),
          venue: groundName === "" ? null : groundName,
          // Superadmin only — admins never send it, so a read-only field
          // can never zero the fee by accident.
          ...(isSuperadmin ? { joining_fee: Number(joiningFee) } : {}),
          start_date: startDate || null, // null = clear (blanked input)
          end_date: endDate || null,
        }),
      });
      setDetailsSaved(true);
      startTransition(() => router.refresh());
    } catch (e) {
      setDetailsError(
        e instanceof Error ? e.message : "Could not save — try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setPending(true);
    setRosterError(null);
    try {
      await callApi(`/api/tournaments/${tournament.id}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      startTransition(() => router.refresh());
    } catch (e) {
      setRosterError(e instanceof Error ? e.message : "Could not add — try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleRemovePlayer() {
    if (!removing) return;
    setPending(true);
    setRosterError(null);
    try {
      await callApi(
        `/api/tournaments/${tournament.id}/players/${removing.id}`,
        { method: "DELETE" },
      );
      setRemoving(null);
      startTransition(() => router.refresh());
    } catch (e) {
      setRemoving(null);
      setRosterError(
        e instanceof Error ? e.message : "Could not remove — try again.",
      );
    } finally {
      setPending(false);
    }
  }

  function handleStatusFlip() {
    const next = readOnly ? "active" : "completed";
    setPending(true);
    setStatusError(null);
    setConfirmStatus(false);
    startTransition(async () => {
      setOptimisticStatus(next);
      try {
        await callApi(`/api/tournaments/${tournament.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        router.refresh();
      } catch (e) {
        setStatusError(
          e instanceof Error ? e.message : "Could not update — try again.",
        );
      } finally {
        setPending(false);
      }
    });
  }

  async function handleDeleteTournament() {
    setPending(true);
    try {
      await callApi(`/api/tournaments/${tournament.id}`, { method: "DELETE" });
      router.push("/tournaments");
      startTransition(() => router.refresh());
    } catch (e) {
      setConfirmDelete(false);
      setStatusError(
        e instanceof Error ? e.message : "Could not delete — try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setDepositOpen(true)}
          className={tileClass}
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-credit-light text-credit-foreground">
            <PlusCircle size={18} />
          </span>
          <span className="text-sm font-semibold">
            Credit
            <span className="block text-[11px] font-normal text-text-muted">
              Player Deposit
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={readOnly}
          onClick={() => setExpenseOpen(true)}
          className={tileClass}
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-debit-light text-debit-foreground">
            <MinusCircle size={18} />
          </span>
          <span className="text-sm font-semibold">
            Debit
            <span className="block text-[11px] font-normal text-text-muted">
              Shared Expense
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={readOnly}
          onClick={() => setScheduleOpen(true)}
          className={tileClass}
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-accent-light text-accent">
            <CalendarPlus size={18} />
          </span>
          <span className="text-sm font-semibold">
            Schedule Matches
            <span className="block text-[11px] font-normal text-text-muted">
              Opponent, Date, Time
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            setRosterError(null);
            setRosterOpen(true);
          }}
          className={tileClass}
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-scheduled-light text-scheduled-foreground">
            <Users size={18} />
          </span>
          <span className="text-sm font-semibold">
            Manage Players
            <span className="block text-[11px] font-normal text-text-muted">
              {activePlayers.length} Active
            </span>
          </span>
        </button>

        <TournamentCaptainTile
          tournamentId={tournament.id}
          players={activePlayers}
          disabled={readOnly}
        />
        <TournamentViceCaptainTile
          tournamentId={tournament.id}
          players={activePlayers}
          disabled={readOnly}
        />

        <button
          type="button"
          onClick={() => {
            setStatusError(null);
            setStatusOpen(true);
          }}
          className={tileClass}
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-low-light text-low-foreground">
            <Flag size={18} />
          </span>
          <span className="text-sm font-semibold">
            Tournament Status
            <span className="block text-[11px] font-normal capitalize text-text-muted">
              {tournament.status}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDetailsError(null);
            setDetailsSaved(false);
            setDetailsOpen(true);
          }}
          className={tileClass}
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-accent-light text-accent">
            <FileText size={18} />
          </span>
          <span className="text-sm font-semibold">
            Details
            <span className="block text-[11px] font-normal text-text-muted">
              Name, Team, Venue, Fee
            </span>
          </span>
        </button>
      </section>

      <SheetShell
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        title="Details"
        description={
          readOnly
            ? "This tournament is completed — details are read-only."
            : "Edit the tournament's name, team, ground, joining fee and dates."
        }
      >
        <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Tournament Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              disabled={readOnly}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Your Team Name{" "}
              <span className="font-normal text-text-muted">(optional)</span>
            </span>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Your team name"
              maxLength={80}
              disabled={readOnly}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Ground name
            </span>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Ground name"
              maxLength={80}
              disabled={readOnly}
              className={inputClass}
            />
          </label>
          <MoneyInput
            label="Joining Fee (settles when the tournament completes)"
            value={joiningFee}
            onChange={setJoiningFee}
            disabled={readOnly || !isSuperadmin}
            required
          />
          {!isSuperadmin && (
            <p className="-mt-2 text-xs text-text-muted">
              Only a superadmin can change the fee.
            </p>
          )}
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">
                Starts
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={readOnly}
                className={inputClass}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">
                Ends
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={readOnly}
                className={inputClass}
              />
            </label>
          </div>
          {detailsError && <p className="text-sm text-debit">{detailsError}</p>}
          {detailsSaved && <p className="text-sm text-credit">Details saved.</p>}
          {!readOnly && (
            <button
              type="submit"
              disabled={pending}
              className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save details"}
            </button>
          )}
        </form>
      </SheetShell>

      <SheetShell
        open={statusOpen}
        onOpenChange={setStatusOpen}
        title="Tournament Status"
        description={
          readOnly
            ? "Completed — the ledger is read-only until reopened."
            : "Active — deposits, expenses and roster changes are open."
        }
      >
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setConfirmStatus(true)}
            className={
              readOnly
                ? "h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground"
                : "h-11 w-full rounded-md border border-border bg-surface text-sm font-medium text-text-primary"
            }
          >
            {readOnly ? "Reopen tournament" : "Mark as completed"}
          </button>
          {isSuperadmin && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="h-11 w-full rounded-md border border-debit-light text-sm font-medium text-debit"
            >
              Delete the tournament
            </button>
          )}
          {statusError && <p className="text-sm text-debit">{statusError}</p>}
        </div>
      </SheetShell>

      <TournamentScheduleMatchSheet
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        tournamentId={tournament.id}
        venue={tournament.venue}
      />
      <TournamentDepositSheet
        open={depositOpen}
        onOpenChange={setDepositOpen}
        tournamentId={tournament.id}
        players={activePlayers.map((p) => ({ id: p.id, name: p.name }))}
      />
      <TournamentExpenseSheet
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        tournamentId={tournament.id}
        activePlayerCount={activePlayers.length}
      />

      <SheetShell
        open={rosterOpen}
        onOpenChange={setRosterOpen}
        title="Manage Players"
        description="Players can only be removed at zero balance and without a captaincy role."
      >
        <div className="flex flex-col gap-3">
          <form onSubmit={handleAddPlayer} className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Player name"
              required
              maxLength={80}
              className={cn(inputClass, "min-w-0 flex-1")}
            />
            <button
              type="submit"
              disabled={pending}
              className="h-11 shrink-0 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              Add
            </button>
          </form>
          {rosterError && <p className="text-sm text-debit">{rosterError}</p>}
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {activePlayers.length === 0 ? (
              <p className="p-4 text-sm text-text-muted">
                No players yet — add the first one above.
              </p>
            ) : (
              activePlayers.map((p) => (
                <div
                  key={p.id}
                  className="flex min-h-11 items-center justify-between gap-3 px-4 py-2"
                >
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-text-primary">
                    {p.name}
                    {p.is_captain && <CaptainMark />}
                    {p.is_vice_captain && <ViceCaptainMark />}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRemoving(p)}
                    disabled={pending}
                    className="shrink-0 rounded-md border border-debit-light px-3 py-1.5 text-xs font-medium text-debit disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetShell>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? "player"}?`}
        description="Only possible at zero balance and without a captaincy role. Players with ledger history stay visible as removed; never-used names are deleted outright."
        confirmLabel="Remove player"
        destructive
        pending={pending}
        onConfirm={handleRemovePlayer}
      />

      <ConfirmDialog
        open={confirmStatus}
        onOpenChange={setConfirmStatus}
        title={readOnly ? "Reopen this tournament?" : "Mark as completed?"}
        description={
          readOnly
            ? "The joining-fee settlement is reversed (charges and fund rows removed) and everything becomes editable again."
            : "Settles the joining fee: it splits equally across the completed matches, and each match's cost plus its car money divides across that match's players (rounded up to the fund). Drivers get their allowance back per match driven, so a heavy driver can end up in surplus. The tournament then becomes read-only (reopening reverses the settlement)."
        }
        confirmLabel={readOnly ? "Reopen" : "Mark completed"}
        pending={pending}
        onConfirm={handleStatusFlip}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${tournament.name}?`}
        description="Superadmin only. The tournament, its full player roster, every match, and every ledger entry and share are permanently removed in one transaction. Team-ledger data is not touched."
        confirmLabel="Delete tournament"
        destructive
        pending={pending}
        onConfirm={handleDeleteTournament}
      />
    </>
  );
}
