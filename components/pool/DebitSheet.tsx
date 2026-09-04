"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { SheetShell } from "@/components/shared/SheetShell";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Switch } from "@/components/ui/switch";
import { ceilSplit } from "@/engine/split";
import { formatRupees, todayIST } from "@/lib/format";
import type { PoolLedgerRow } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activePlayerCount: number;
  // Lets the ledger list show the row the moment it is sent (the owner's
  // useOptimistic reconciles it on refresh). Mirrors CreditSheet.
  onOptimisticAdd?: (row: PoolLedgerRow) => void;
};

export function DebitSheet({
  open,
  onOpenChange,
  activePlayerCount,
  onOptimisticAdd,
}: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [common, setCommon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const value = Number(amount);
  const validAmount = Number.isInteger(value) && value > 0;
  const preview =
    common && validAmount && activePlayerCount > 0
      ? ceilSplit(value, activePlayerCount)
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validAmount) {
      setError("Enter a whole-rupee amount above zero.");
      return;
    }
    setError(null);
    setPending(true);
    const payload = {
      common,
      amount: value,
      message: message.trim(),
      entry_date: date || undefined,
    };
    // The row the ledger will show once the write lands: debits are
    // stored negative; the server's own id/created_at replace these on
    // refresh. The amount shown is exactly what the admin typed.
    const optimisticRow: PoolLedgerRow = {
      id: `optimistic-${Date.now()}`,
      entry_date: payload.entry_date ?? todayIST(),
      kind: common ? "common_debit" : "plain_debit",
      message: payload.message,
      amount: -value,
      edited_by: null,
      player_name: null,
      created_at: new Date().toISOString(),
      match_id: null,
      match_opponent: null,
      match_status: null,
    };
    startTransition(async () => {
      if (onOptimisticAdd) onOptimisticAdd(optimisticRow);
      try {
        const res = await fetch("/api/pool/debit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!body.success) {
          setError(body.error?.message ?? "Could not save — try again.");
          return;
        }
        onOpenChange(false);
        setAmount("");
        setMessage("");
        setDate("");
        setCommon(false);
        router.refresh();
      } catch {
        setError("Could not reach the server — check your connection.");
      } finally {
        setPending(false);
      }
    });
  }

  const inputClass =
    "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      title="Pool debit"
      description="Plain debits only lower the pool. Common debits also charge every active player their share."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <MoneyInput label="Amount" value={amount} onChange={setAmount} required />

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            Message
          </span>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What the money was spent on"
            required
            className={inputClass}
          />
        </label>

        <div className="flex items-end gap-3">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Date (optional)
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex h-11 items-center gap-2">
            <span className="text-sm font-medium text-text-secondary">
              Common?
            </span>
            <Switch checked={common} onCheckedChange={setCommon} />
          </label>
        </div>

        {common && (
          <div className="rounded-md border border-accent-light bg-accent-light/40 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
              Split preview
            </p>
            {preview ? (
              <>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  ₹{formatRupees(preview.share)} × {preview.players} active
                  players
                </p>
                <p className="text-xs text-text-secondary">
                  Each share is charged to the player&apos;s balance — nothing
                  is credited back to the pool.
                </p>
                <p className="text-xs font-medium text-debit">
                  Pool effect −₹{formatRupees(value)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-text-secondary">
                Enter an amount to see each player&apos;s share.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-debit">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : common ? "Confirm common debit" : "Add debit"}
        </button>
      </form>
    </SheetShell>
  );
}
