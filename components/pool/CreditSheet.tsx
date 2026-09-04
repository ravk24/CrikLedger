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
  // Lets the ledger list show the new row before the write lands. Only
  // player deposits / dues / other income are simple enough to predict;
  // a ground booking writes several rows and waits for the refresh.
  onOptimisticAdd?: (row: PoolLedgerRow) => void;
};

type CreditKind = "deposit" | "ground_booking" | "other_income" | "opening_due";

const KIND_OPTIONS: [CreditKind, string][] = [
  ["deposit", "Player deposit"],
  ["ground_booking", "Ground booking"],
  ["other_income", "Other income"],
  ["opening_due", "Last season due"],
];

const MAX_SLOTS = 20;

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
  // Ground booking fields
  const [teamName, setTeamName] = useState("");
  const [captain, setCaptain] = useState("");
  const [slots, setSlots] = useState("1");
  const [amountPaid, setAmountPaid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const slotCount = Math.min(Math.max(Number(slots) || 0, 0), MAX_SLOTS);

  function resetForm() {
    setAmount("");
    setMessage("");
    setDate("");
    setTeamName("");
    setCaptain("");
    setSlots("1");
    setAmountPaid("");
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

    if (kind === "ground_booking") {
      const paid = Number(amountPaid) || 0;
      if (!teamName.trim() || !captain.trim()) {
        setError("Enter the team name and captain.");
        return;
      }
      if (slotCount < 1) {
        setError("Book at least one slot.");
        return;
      }
      if (paid <= 0) {
        setError("Enter the amount paid.");
        return;
      }
      post({
        kind,
        team_name: teamName.trim(),
        captain: captain.trim(),
        slots: slotCount,
        amount_paid: paid,
        entry_date: date || undefined,
      });
      return;
    }

    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      setError("Enter a whole-rupee amount above zero.");
      return;
    }
    const playerLinked = kind === "deposit" || kind === "opening_due";
    if (playerLinked && !playerId) {
      setError(
        kind === "deposit"
          ? "Pick the player who deposited."
          : "Pick the player who carries the due.",
      );
      return;
    }
    post(
      {
        kind,
        amount: value,
        // Player-linked rows title themselves by player — message optional.
        message: message.trim() || undefined,
        player_id: playerLinked ? playerId : undefined,
        entry_date: date || undefined,
      },
      {
        id: `optimistic-${Date.now()}`,
        entry_date: date || new Date().toISOString().slice(0, 10),
        kind,
        message: message.trim(),
        amount: value,
        edited_by: null,
        player_name: playerLinked
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
      description={
        kind === "ground_booking"
          ? "Records the booking and credits what was paid to the pool."
          : kind === "opening_due"
            ? "Season-1 carryforward: deducted from the player's balance (shows red until they pay). Not added to the pool."
            : "Deposits raise the player's balance too — other credits only raise the pool."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {!lockKind && (
          <div className="grid grid-cols-2 gap-2">
            {KIND_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
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

        {(kind === "deposit" || kind === "opening_due") && (
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

        {kind === "ground_booking" ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">
                Team name
              </span>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Opponent team name"
                required
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">
                Captain
              </span>
              <input
                type="text"
                value={captain}
                onChange={(e) => setCaptain(e.target.value)}
                placeholder="Captain's name"
                required
                className={inputClass}
              />
            </label>

            <div className="flex gap-3">
              <label className="flex w-24 shrink-0 flex-col gap-1">
                <span className="text-xs font-medium text-text-secondary">
                  Slots booked
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_SLOTS}
                  value={slots}
                  onChange={(e) => setSlots(e.target.value)}
                  required
                  className={inputClass}
                />
              </label>
              <div className="flex-1">
                <MoneyInput
                  label="Amount paid"
                  value={amountPaid}
                  onChange={setAmountPaid}
                  required
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <MoneyInput
              label="Amount"
              value={amount}
              onChange={setAmount}
              required
            />

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">
                {kind === "other_income" ? "Message" : "Message (optional)"}
              </span>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  kind === "deposit"
                    ? "August deposit"
                    : kind === "opening_due"
                      ? "Season 1 due"
                      : "Sponsor chip-in"
                }
                required={kind === "other_income"}
                className={inputClass}
              />
            </label>
          </>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            {kind === "ground_booking"
              ? "Booking date (optional — today if empty)"
              : "Date (optional — today if empty)"}
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
          {pending
            ? "Saving…"
            : kind === "ground_booking"
              ? "Save booking"
              : kind === "opening_due"
                ? "Record due"
                : "Add credit"}
        </button>
      </form>
    </SheetShell>
  );
}
