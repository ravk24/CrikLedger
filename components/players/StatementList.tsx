"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Money } from "@/components/shared/Money";
import { SheetShell } from "@/components/shared/SheetShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { cn } from "@/lib/utils";
import { formatDate, formatDateShort } from "@/lib/format";

export type StatementRow = {
  player_id: string;
  entry_date: string;
  kind:
    | "deposit"
    | "driver_rebate"
    | "match_fee"
    | "guest_fee"
    | "expense_share"
    | "opening_due";
  description: string;
  delta: number;
  match_id: string | null;
  running_balance: number;
  source_id: string;
  edited_by: string | null;
};

type Props = {
  rows: StatementRow[];
  // Admin viewers get "Edit entry" on rows backed by a manual pool
  // entry. Everyone can expand; match rows link to the match instead.
  canEdit: boolean;
};

const KIND_SUFFIX: Partial<Record<StatementRow["kind"], string>> = {
  driver_rebate: "car rebate",
  guest_fee: "guest fees",
  expense_share: "common expense",
  opening_due: "last season due",
};

// deposit/opening_due rows: source_id IS the pool_entries id, so the
// pool entry edit API applies directly. expense_share rows show a
// per-player slice of a common debit — editing that re-splits every
// player, so the Ledger page stays the edit venue for those.
const EDITABLE_KINDS: StatementRow["kind"][] = ["deposit", "opening_due"];

function StatementRowItem({
  row,
  onEdit,
}: {
  row: StatementRow;
  onEdit?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const suffix = KIND_SUFFIX[row.kind];
  // Player-linked rows may carry no message; the player is implicit on
  // this page, so a plain kind label is title enough.
  const title =
    row.description ||
    (row.kind === "opening_due" ? "Season due" : "Deposit");

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-sm font-medium text-text-primary",
              expanded ? "break-words" : "truncate",
            )}
          >
            {title}
          </span>
          <span className="block text-xs text-text-muted">
            {formatDateShort(row.entry_date)}
            {suffix && ` · ${suffix}`}
          </span>
        </span>
        <Money
          amount={row.delta}
          variant="signed"
          className="w-20 shrink-0 text-right text-sm font-semibold"
        />
        <Money
          amount={row.running_balance}
          variant="balance"
          className="w-16 shrink-0 text-right text-sm tabular-nums text-text-secondary"
        />
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-text-muted transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 bg-surface-secondary px-4 py-3">
          {row.description && (
            <p className="break-words text-sm text-text-primary">
              {row.description}
            </p>
          )}
          <p className="text-xs text-text-muted">
            {formatDate(row.entry_date)}
            {suffix && ` · ${suffix}`}
            {row.edited_by && <> · entry by {row.edited_by}</>}
          </p>
          {row.match_id && (
            <Link
              href={`/matches/${row.match_id}`}
              className="flex h-10 w-full items-center justify-center rounded-md border border-border bg-surface text-sm font-medium text-accent"
            >
              View match
            </Link>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="h-10 w-full rounded-md border border-border bg-surface text-sm font-medium text-accent"
            >
              Edit entry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function StatementList({ rows, canEdit }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<StatementRow | null>(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function openEdit(row: StatementRow) {
    setEditing(row);
    setAmount(String(Math.abs(Math.round(Number(row.delta)))));
    setMessage(row.description);
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
      const res = await fetch(`/api/pool/entries/${editing.source_id}`, {
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
  }

  async function handleDelete() {
    if (!editing) return;
    setPending(true);
    try {
      const res = await fetch(`/api/pool/entries/${editing.source_id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not delete — try again.");
        return;
      }
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
      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex items-baseline border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-text-muted">
          <span className="flex-1">Entry</span>
          <span className="w-20 text-right">Amount</span>
          <span className="w-16 text-right">Balance</span>
          <span className="w-4" />
        </div>
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <StatementRowItem
              key={row.source_id}
              row={row}
              onEdit={
                canEdit && EDITABLE_KINDS.includes(row.kind)
                  ? () => openEdit(row)
                  : undefined
              }
            />
          ))}
        </div>
      </section>

      <SheetShell
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit entry"
        description="Manual entry — amount keeps its original direction. Changes show on the Ledger too."
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-3">
          <MoneyInput label="Amount" value={amount} onChange={setAmount} required />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Message (optional)
            </span>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
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
        description="This removes the entry and its effect on the player's balance and the pool."
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={handleDelete}
      />
    </>
  );
}
