"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { SheetShell } from "@/components/shared/SheetShell";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { ceilSplit } from "@/engine/split";
import { formatRupees } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  activePlayerCount: number;
};

// Always-common variant of the pool DebitSheet: every tournament
// expense splits across the current active roster. The preview uses
// the same client-side ceilSplit; the route recomputes authoritatively.
export function TournamentExpenseSheet({
  open,
  onOpenChange,
  tournamentId,
  activePlayerCount,
}: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const value = Number(amount);
  const validAmount = Number.isInteger(value) && value > 0;
  const preview =
    validAmount && activePlayerCount > 0
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
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/expense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: value,
          message: message.trim(),
          ...(date ? { entry_date: date } : {}),
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not save — try again.");
        return;
      }
      posthog.capture("tournament_expense_added", {
        amount: value,
        active_player_count: activePlayerCount,
      });
      onOpenChange(false);
      setAmount("");
      setMessage("");
      setDate("");
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <SheetShell
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setError(null); // no stale errors on reopen
      }}
      title="Shared expense"
      description="Split equally across the tournament's current players — players added later won't owe a share."
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
            placeholder="Umpire fee"
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            Date <span className="font-normal text-text-muted">(optional)</span>
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="rounded-md border border-accent-light bg-accent-light/40 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
            Split preview
          </p>
          {preview ? (
            <>
              <p className="mt-1 text-sm font-semibold text-text-primary">
                ₹{formatRupees(preview.share)} × {preview.players} players
              </p>
              <p className="text-xs text-text-secondary">
                Each share is charged to the player&apos;s tournament balance.
              </p>
              <p className="text-xs font-medium text-debit">
                Fund effect −₹{formatRupees(value)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-text-secondary">
              {activePlayerCount === 0
                ? "Add players first — there is no one to split across."
                : "Enter an amount to see each player's share."}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-debit">{error}</p>}
        <button
          type="submit"
          disabled={pending || activePlayerCount === 0}
          className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : "Confirm shared expense"}
        </button>
      </form>
    </SheetShell>
  );
}
