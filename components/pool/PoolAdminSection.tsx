"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { Minus, Plus } from "lucide-react";
import { LedgerRow } from "@/components/shared/LedgerRow";
import { SheetShell } from "@/components/shared/SheetShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { CreditSheet } from "@/components/pool/CreditSheet";
import { DebitSheet } from "@/components/pool/DebitSheet";
import type { PoolLedgerRow } from "@/types";

type PlayerOption = { id: string; name: string };

type Props = {
  entries: PoolLedgerRow[];
  players: PlayerOption[];
  activePlayerCount: number;
};

const MANUAL_KINDS: PoolLedgerRow["kind"][] = [
  "deposit",
  "other_income",
  "equipment",
  "ground_booking",
  "plain_debit",
  "common_debit",
  "opening_due",
];

// Admin mode for P4: manual rows tap-to-edit, locked auto rows inert,
// Credit/Debit buttons in a row above the ledger.
export function PoolAdminSection({ entries, players, activePlayerCount }: Props) {
  const router = useRouter();
  const [creditOpen, setCreditOpen] = useState(false);
  const [debitOpen, setDebitOpen] = useState(false);
  const [editing, setEditing] = useState<PoolLedgerRow | null>(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function openEdit(entry: PoolLedgerRow) {
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
      const res = await fetch(`/api/pool/entries/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, message: message.trim() }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not save — try again.");
        return;
      }
      posthog.capture("pool_entry_updated", {
        entry_kind: editing.kind,
      });
      setEditing(null);
      router.refresh();
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
      const res = await fetch(`/api/pool/entries/${editing.id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not delete — try again.");
        return;
      }
      posthog.capture("pool_entry_deleted", {
        entry_kind: editing.kind,
      });
      setConfirmDelete(false);
      setEditing(null);
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

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

      <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {entries.map((entry) => (
          <LedgerRow
            key={entry.id}
            entry={entry}
            onEdit={
              MANUAL_KINDS.includes(entry.kind)
                ? () => openEdit(entry)
                : undefined
            }
          />
        ))}
      </section>

      <CreditSheet
        open={creditOpen}
        onOpenChange={setCreditOpen}
        players={players}
      />
      <DebitSheet
        open={debitOpen}
        onOpenChange={setDebitOpen}
        activePlayerCount={activePlayerCount}
      />

      <SheetShell
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit entry"
        description={
          editing?.kind === "common_debit"
            ? "Changing the amount re-splits every active player's share."
            : "Manual entry — amount keeps its original direction."
        }
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-3">
          <MoneyInput label="Amount" value={amount} onChange={setAmount} required />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              {editing?.kind === "deposit" || editing?.kind === "opening_due"
                ? "Message (optional)"
                : "Message"}
            </span>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required={
                editing?.kind !== "deposit" && editing?.kind !== "opening_due"
              }
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
            ? "The debit and every player's share are removed together."
            : "This removes the entry and its effect on the pool balance."
        }
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={handleDelete}
      />
    </>
  );
}
