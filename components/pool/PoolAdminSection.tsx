"use client";

import { startTransition, useOptimistic, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { LedgerRow } from "@/components/shared/LedgerRow";
import { SheetShell } from "@/components/shared/SheetShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { CreditSheet } from "@/components/pool/CreditSheet";
import { DebitSheet } from "@/components/pool/DebitSheet";
import { DownloadImageButton } from "@/components/shared/DownloadImageButton";
import { opponentLabel } from "@/lib/format";
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
type LedgerChange =
  | { type: "edit"; id: string; amount: number; message: string }
  | { type: "delete"; id: string }
  | { type: "add"; row: PoolLedgerRow };

// A fee row of a completed match is locked: its amount is already
// baked into the match's stored collection, so only the match's own
// delete may remove it (the server refuses with 409 as the backstop).
function isSettledMatchFee(entry: PoolLedgerRow | null) {
  return entry?.match_id != null && entry.match_status === "completed";
}

function deleteDescription(entry: PoolLedgerRow | null): string {
  if (entry?.kind === "common_debit") {
    return "The debit and every player's share are removed together.";
  }
  if (entry?.match_id && entry.match_status === "scheduled") {
    return `This is the match fee vs ${opponentLabel(entry.match_opponent)}. Deleting it also deletes that scheduled match.`;
  }
  return "This removes the entry and its effect on the pool balance.";
}

function applyLedgerChange(state: PoolLedgerRow[], change: LedgerChange) {
  switch (change.type) {
    case "edit":
      return state.map((e) =>
        e.id === change.id
          ? { ...e, amount: change.amount, message: change.message }
          : e,
      );
    case "delete":
      return state.filter((e) => e.id !== change.id);
    case "add":
      return [change.row, ...state];
  }
}

export function PoolAdminSection({
  entries: serverEntries,
  players,
  activePlayerCount,
}: Props) {
  // The list reflects an edit, delete or new credit the moment it is
  // sent; the refresh after the write reconciles it with the ledger
  // (and restores the row if the write failed).
  const [entries, changeLedger] = useOptimistic(
    serverEntries,
    applyLedgerChange,
  );
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
    const target = editing;
    setPending(true);
    setError(null);
    startTransition(async () => {
      // The stored amount keeps the entry's sign (debits are negative).
      changeLedger({
        type: "edit",
        id: target.id,
        amount: target.amount < 0 ? -value : value,
        message: message.trim(),
      });
      try {
        const res = await fetch(`/api/pool/entries/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: value, message: message.trim() }),
        });
        const body = await res.json();
        if (!body.success) {
          setError(body.error?.message ?? "Could not save — try again.");
          return;
        }
        setEditing(null);
        router.refresh();
      } catch {
        setError("Could not reach the server — check your connection.");
      } finally {
        setPending(false);
      }
    });
  }

  function handleDelete() {
    if (!editing) return;
    const target = editing;
    setPending(true);
    setError(null);
    setConfirmDelete(false);
    // The sheet stays open until the server agrees, so a refusal (a
    // completed match's fee, a stale row) is visible; the optimistic
    // removal reverts on its own when the transition settles.
    startTransition(async () => {
      changeLedger({ type: "delete", id: target.id });
      try {
        const res = await fetch(`/api/pool/entries/${target.id}`, {
          method: "DELETE",
        });
        const body = await res.json();
        if (!body.success) {
          setError(body.error?.message ?? "Could not delete — try again.");
          return;
        }
        setEditing(null);
        // A match fee delete also removed its scheduled match; the
        // match never appears in the ledger, so a refresh is all the
        // UI needs.
        router.refresh();
      } catch {
        setError("Could not reach the server — check your connection.");
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
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
        <DownloadImageButton
          endpoint="/api/share/ledger"
          filename="ledger.png"
          title="Ledger"
        />
      </div>

      <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card">
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
        onOptimisticAdd={(row) => changeLedger({ type: "add", row })}
      />
      <DebitSheet
        open={debitOpen}
        onOpenChange={setDebitOpen}
        activePlayerCount={activePlayerCount}
        onOptimisticAdd={(row) => changeLedger({ type: "add", row })}
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
          {isSettledMatchFee(editing) ? (
            <p className="text-xs text-text-muted">
              This fee is settled inside the completed match vs{" "}
              {opponentLabel(editing?.match_opponent)} — delete the match
              instead.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
              className="h-11 w-full rounded-md border border-debit-light text-sm font-medium text-debit disabled:opacity-60"
            >
              Delete entry
            </button>
          )}
        </form>
      </SheetShell>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this entry?"
        description={deleteDescription(editing)}
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={handleDelete}
      />
    </>
  );
}
