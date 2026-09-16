"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { LedgerRow } from "@/components/shared/LedgerRow";
import { SheetShell } from "@/components/shared/SheetShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { CreditSheet } from "@/components/pool/CreditSheet";
import { DebitSheet } from "@/components/pool/DebitSheet";
import { isManualKind, isPlayerLinked } from "@/lib/poolKinds";
import type { TournamentLedgerRow } from "@/types";

type PlayerOption = { id: string; name: string; is_captain?: boolean };

type Props = {
  tournamentId: string;
  entries: TournamentLedgerRow[];
  players: PlayerOption[]; // active roster — the sheets' player pickers
  activePlayerCount: number;
};

// Admin section of the tournament Ledger tab — the /pool admin view for
// one tournament's isolated fund. Credit / Debit sit above the list
// (moved here from the Admin tab's money tiles, 2026-09-16) and reuse
// the pool sheets pointed at the tournament routes: Credit = player
// deposit · other income; Debit = expense · withdrawal (no season due —
// a tournament has no last season). Rows are tap-to-edit with delete
// behind a confirm. Rendered only for admins on an ACTIVE tournament
// (completed = read-only, handled by the page).
export function TournamentLedgerSection({
  tournamentId,
  entries,
  players,
  activePlayerCount,
}: Props) {
  const router = useRouter();
  const [creditOpen, setCreditOpen] = useState(false);
  const [debitOpen, setDebitOpen] = useState(false);
  const [editing, setEditing] = useState<TournamentLedgerRow | null>(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function openEdit(entry: TournamentLedgerRow) {
    setEditing(entry);
    setAmount(String(Math.abs(Math.round(Number(entry.amount)))));
    setMessage(entry.message);
    setError(null);
    setConfirmDelete(false);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      setError("Enter a whole-rupee amount above zero.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/entries/${editing.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: value, message: message.trim() }),
        },
      );
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not save — try again.");
        return;
      }
      setEditing(null);
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setPending(true);
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/entries/${editing.id}`,
        { method: "DELETE" },
      );
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not delete — try again.");
        return;
      }
      setConfirmDelete(false);
      setEditing(null);
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  const editingPlayerLinked = isPlayerLinked(editing?.kind);

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setCreditOpen(true)}
          className="flex h-11 items-center justify-center gap-1 rounded-md bg-accent text-sm font-medium text-accent-foreground"
        >
          <Plus size={16} /> Credit
        </button>
        <button
          type="button"
          onClick={() => setDebitOpen(true)}
          className="flex h-11 items-center justify-center gap-1 rounded-md bg-text-primary text-sm font-medium text-surface"
        >
          <Minus size={16} /> Debit
        </button>
      </div>

      <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {entries.length === 0 ? (
          <p className="p-4 text-sm text-text-muted">
            No entries yet — use Credit or Debit above to record the first
            one.
          </p>
        ) : (
          entries.map((entry) => (
            <LedgerRow
              key={entry.id}
              entry={entry}
              // Auto rows (settlement + legacy match surplus) are locked
              // here and 409 AUTO_ENTRY server-side.
              onEdit={
                isManualKind(entry.kind) ? () => openEdit(entry) : undefined
              }
            />
          ))
        )}
      </section>

      <CreditSheet
        open={creditOpen}
        onOpenChange={setCreditOpen}
        players={players}
        endpoint={`/api/tournaments/${tournamentId}/credit`}
        title="Tournament credit"
        fundNoun="fund"
      />
      <DebitSheet
        open={debitOpen}
        onOpenChange={setDebitOpen}
        players={players}
        activePlayerCount={activePlayerCount}
        endpoint={`/api/tournaments/${tournamentId}/debit`}
        title="Tournament debit"
        fundNoun="fund"
        kinds={["expense", "withdrawal"]}
      />

      <SheetShell
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit entry"
        description={
          editing?.kind === "common_debit"
            ? "Changing the amount re-splits the share across the current players."
            : "Manual entry — amount keeps its original direction."
        }
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-3">
          <MoneyInput label="Amount" value={amount} onChange={setAmount} required />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              {editingPlayerLinked ? "Message (optional)" : "Message"}
            </span>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required={!editingPlayerLinked}
              className="h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          {error && <p className="text-sm text-debit">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={pending}
            className="h-11 w-full rounded-md border border-debit-light text-sm font-medium text-debit disabled:opacity-60"
          >
            Delete entry
          </button>
        </form>
      </SheetShell>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this entry?"
        description={
          editing?.kind === "common_debit"
            ? "The expense and every player's share are removed together."
            : editingPlayerLinked && editing?.player_name
              ? `This removes the entry and its effect on the fund and on ${editing.player_name}'s balance.`
              : "This removes the entry and its effect on the fund balance."
        }
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={handleDelete}
      />
    </>
  );
}
