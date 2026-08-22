"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { LedgerRow } from "@/components/shared/LedgerRow";
import { SheetShell } from "@/components/shared/SheetShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MoneyInput } from "@/components/shared/MoneyInput";
import type { TournamentLedgerRow } from "@/types";

type Props = {
  tournamentId: string;
  entries: TournamentLedgerRow[];
};

// Admin section of the tournament Ledger tab: tap-to-edit rows and
// delete with confirm. New money entries start from the Admin tab's
// Credit/Debit cards (Ravi 2026-08-15). Rendered only for admins on
// an ACTIVE tournament (completed = read-only, handled by the page).
export function TournamentLedgerSection({ tournamentId, entries }: Props) {
  const router = useRouter();
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

  return (
    <>
      <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {entries.length === 0 ? (
          <p className="p-4 text-sm text-text-muted">
            No entries yet — record a deposit or a shared expense from the
            Admin tab.
          </p>
        ) : (
          entries.map((entry) => (
            <LedgerRow
              key={entry.id}
              entry={entry}
              // Auto rows (settlement + legacy match surplus) are locked
              // here and 409 AUTO_ENTRY server-side.
              onEdit={
                ["match_collection", "joining_fee", "tournament_collection"].includes(
                  entry.kind,
                )
                  ? undefined
                  : () => openEdit(entry)
              }
            />
          ))
        )}
      </section>

      <SheetShell
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit entry"
        description={
          editing?.kind === "common_debit"
            ? "Changing the amount re-splits the share across the current players."
            : "Deposit — amount keeps its original direction."
        }
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-3">
          <MoneyInput label="Amount" value={amount} onChange={setAmount} required />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              {editing?.kind === "deposit" ? "Message (optional)" : "Message"}
            </span>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required={editing?.kind !== "deposit"}
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
            : "This removes the deposit and its effect on the player's balance."
        }
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={handleDelete}
      />
    </>
  );
}
