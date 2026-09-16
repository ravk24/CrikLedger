"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { SheetShell } from "@/components/shared/SheetShell";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { cn } from "@/lib/utils";
import type { PoolLedgerRow } from "@/types";

type PlayerOption = { id: string; name: string; is_captain?: boolean };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: PlayerOption[]; // active players only
  // Reuse from other entry points: preselect a kind, hide the kind
  // picker, and retitle the sheet.
  title?: string;
  initialKind?: CreditKind;
  lockKind?: boolean;
  // Lets the ledger list show the new row before the write lands.
  onOptimisticAdd?: (row: PoolLedgerRow) => void;
};

// Everything here ADDS to the pool. Debits, withdrawals and season dues
// live in DebitSheet. (Ground booking credits were retired 2026-09-16 —
// schedule a match with "Credit to Pool", or record Other income; old
// rows keep their BOOKING chip.)
type CreditKind = "deposit" | "other_income";

const KIND_OPTIONS: [CreditKind, string][] = [
  ["deposit", "Player deposit"],
  ["other_income", "Other income"],
];

export function CreditSheet({
  open,
  onOpenChange,
  players,
  title = "Pool credit",
  initialKind = "deposit",
  lockKind = false,
  onOptimisticAdd,
}: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<CreditKind>(initialKind);
  const [playerId, setPlayerId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isDeposit = kind === "deposit";

  function resetForm() {
    setAmount("");
    setMessage("");
    setDate("");
  }

  function post(payload: unknown, optimisticRow?: PoolLedgerRow) {
    setError(null);
    setPending(true);
    startTransition(async () => {
      if (optimisticRow && onOptimisticAdd) onOptimisticAdd(optimisticRow);
      try {
        const res = await fetch("/api/pool/credit", {
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
        resetForm();
        router.refresh();
      } catch {
        setError("Could not reach the server — check your connection.");
      } finally {
        setPending(false);
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      setError("Enter a whole-rupee amount above zero.");
      return;
    }
    if (isDeposit && !playerId) {
      setError("Pick the player who deposited.");
      return;
    }
    post(
      {
        kind,
        amount: value,
        // Deposits title themselves by player — message optional.
        message: message.trim() || undefined,
        player_id: isDeposit ? playerId : undefined,
        entry_date: date || undefined,
      },
      {
        id: `optimistic-${Date.now()}`,
        entry_date: date || new Date().toISOString().slice(0, 10),
        kind,
        message: message.trim(),
        amount: value,
        edited_by: null,
        player_name: isDeposit
          ? (players.find((p) => p.id === playerId)?.name ?? null)
          : null,
        created_at: new Date().toISOString(),
        match_id: null,
        match_opponent: null,
        match_status: null,
      },
    );
  }

  const inputClass =
    "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Deposits raise the player's balance too — other credits only raise the pool."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {!lockKind && (
          <div className="grid grid-cols-2 gap-2">
            {KIND_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                onClick={() => {
                  setKind(value);
                  setError(null);
                }}
                className={cn(
                  "h-11 rounded-md border text-sm font-medium",
                  kind === value
                    ? "border-accent bg-accent-light text-accent"
                    : "border-border bg-surface text-text-secondary",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {isDeposit && (
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
            {isDeposit ? "Message (optional)" : "Message"}
          </span>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isDeposit ? "August deposit" : "Sponsor chip-in"}
            required={!isDeposit}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            Date (optional — today if empty)
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && <p className="text-sm text-debit">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add credit"}
        </button>
      </form>
    </SheetShell>
  );
}
