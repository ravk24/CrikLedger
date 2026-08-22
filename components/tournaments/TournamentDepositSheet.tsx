"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { SheetShell } from "@/components/shared/SheetShell";
import { MoneyInput } from "@/components/shared/MoneyInput";

type PlayerOption = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  players: PlayerOption[]; // active tournament roster only
};

// Deposit branch of the pool CreditSheet, scoped to one tournament's
// isolated roster and ledger.
export function TournamentDepositSheet({
  open,
  onOpenChange,
  tournamentId,
  players,
}: Props) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!playerId) {
      setError("Choose the player.");
      return;
    }
    if (!Number.isInteger(value) || value <= 0) {
      setError("Enter a whole-rupee amount above zero.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: playerId,
          amount: value,
          ...(message.trim() ? { message: message.trim() } : {}),
          ...(date ? { entry_date: date } : {}),
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not save — try again.");
        return;
      }
      onOpenChange(false);
      setPlayerId("");
      setAmount("");
      setMessage("");
      setDate("");
      startTransition(() => router.refresh());
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
      title="Tournament deposit"
      description="Raises the player's tournament balance and the fund."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {players.length === 0 && (
          <p className="rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-secondary">
            Add players first — there is no one to deposit for.
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">Player</span>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">Choose a player…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <MoneyInput label="Amount" value={amount} onChange={setAmount} required />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            Message <span className="font-normal text-text-muted">(optional)</span>
          </span>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Entry fee contribution"
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
        {error && <p className="text-sm text-debit">{error}</p>}
        <button
          type="submit"
          disabled={pending || players.length === 0}
          className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add deposit"}
        </button>
      </form>
    </SheetShell>
  );
}
