"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { SheetShell } from "@/components/shared/SheetShell";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Switch } from "@/components/ui/switch";
import { ceilSplit } from "@/engine/split";
import { formatRupees, todayIST } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PoolLedgerRow } from "@/types";

type PlayerOption = { id: string; name: string; is_captain?: boolean };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: PlayerOption[]; // active players only — withdrawal picker
  activePlayerCount: number;
  // Lets the ledger list show the row the moment it is sent (the owner's
  // useOptimistic reconciles it on refresh). Mirrors CreditSheet.
  onOptimisticAdd?: (row: PoolLedgerRow) => void;
};

// Two things leave the pool from here: an expense (plain, or common —
// split across every active player) and a withdrawal — a player taking
// part of their deposit back, which lowers the pool and that player's
// balance together. Same 2-up kind control as CreditSheet.
type DebitKind = "expense" | "withdrawal";

const KIND_OPTIONS: [DebitKind, string][] = [
  ["expense", "Expense"],
  ["withdrawal", "Withdrawal"],
];

export function DebitSheet({
  open,
  onOpenChange,
  players,
  activePlayerCount,
  onOptimisticAdd,
}: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<DebitKind>("expense");
  const [playerId, setPlayerId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [common, setCommon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isWithdrawal = kind === "withdrawal";
  const value = Number(amount);
  const validAmount = Number.isInteger(value) && value > 0;
  const preview =
    !isWithdrawal && common && validAmount && activePlayerCount > 0
      ? ceilSplit(value, activePlayerCount)
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validAmount) {
      setError("Enter a whole-rupee amount above zero.");
      return;
    }
    if (isWithdrawal && !playerId) {
      setError("Pick the player taking money out.");
      return;
    }
    setError(null);
    setPending(true);
    const payload = isWithdrawal
      ? {
          kind,
          amount: value,
          // Withdrawals title themselves by player — message optional.
          message: message.trim() || undefined,
          player_id: playerId,
          entry_date: date || undefined,
        }
      : {
          kind,
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
      kind: isWithdrawal
        ? "withdrawal"
        : common
          ? "common_debit"
          : "plain_debit",
      message: message.trim(),
      amount: -value,
      edited_by: null,
      player_name: isWithdrawal
        ? (players.find((p) => p.id === playerId)?.name ?? null)
        : null,
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
        setKind("expense");
        setPlayerId("");
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
      description={
        isWithdrawal
          ? "A withdrawal returns part of a player's deposit. It lowers the pool and that player's balance."
          : "Plain debits only lower the pool. Common debits also charge every active player their share."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {KIND_OPTIONS.map(([option, label]) => (
            <button
              key={option}
              type="button"
              aria-pressed={kind === option}
              onClick={() => {
                setKind(option);
                setError(null);
              }}
              className={cn(
                "h-11 rounded-md border text-sm font-medium",
                kind === option
                  ? "border-accent bg-accent-light text-accent"
                  : "border-border bg-surface text-text-secondary",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {isWithdrawal && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Player
            </span>
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              required
              className={inputClass}
            >
              <option value="" disabled>
                Choose a player…
              </option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.is_captain ? " (C)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <MoneyInput label="Amount" value={amount} onChange={setAmount} required />

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            {isWithdrawal ? "Message (optional)" : "Message"}
          </span>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              isWithdrawal ? "Stake returned" : "What the money was spent on"
            }
            required={!isWithdrawal}
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
          {!isWithdrawal && (
            <label className="flex h-11 items-center gap-2">
              <span className="text-sm font-medium text-text-secondary">
                Common?
              </span>
              <Switch checked={common} onCheckedChange={setCommon} />
            </label>
          )}
        </div>

        {!isWithdrawal && common && (
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
          {pending
            ? "Saving…"
            : isWithdrawal
              ? "Record withdrawal"
              : common
                ? "Confirm common debit"
                : "Add debit"}
        </button>
      </form>
    </SheetShell>
  );
}
