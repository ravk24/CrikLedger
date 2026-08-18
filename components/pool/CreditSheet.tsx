"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { SheetShell } from "@/components/shared/SheetShell";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { cn } from "@/lib/utils";

type PlayerOption = { id: string; name: string; is_captain?: boolean };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: PlayerOption[]; // active players only
  // Reuse from other entry points (e.g. the Schedule match tile):
  // preselect a kind, hide the kind picker, and retitle the sheet.
  title?: string;
  initialKind?: CreditKind;
  lockKind?: boolean;
  // Pre-fill slot 1's date (scheduling from the available-slots page).
  initialSlotDate?: string;
};

type CreditKind =
  | "deposit"
  | "ground_booking"
  | "other_income"
  | "opening_due";

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
  initialSlotDate,
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
  const [amountPending, setAmountPending] = useState("0");
  const [slotDates, setSlotDates] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const slotCount = Math.min(Math.max(Number(slots) || 0, 0), MAX_SLOTS);

  // Each open may come from tapping a different slot — refresh slot 1.
  useEffect(() => {
    if (open && initialSlotDate) {
      setSlotDates((dates) =>
        dates.map((d, i) => (i === 0 ? initialSlotDate : d)),
      );
    }
  }, [open, initialSlotDate]);

  function changeSlots(value: string) {
    setSlots(value);
    const count = Math.min(Math.max(Number(value) || 0, 0), MAX_SLOTS);
    setSlotDates((dates) =>
      Array.from({ length: count }, (_, i) => dates[i] ?? ""),
    );
  }

  function resetForm() {
    setAmount("");
    setMessage("");
    setDate("");
    setTeamName("");
    setCaptain("");
    setSlots("1");
    setAmountPaid("");
    setAmountPending("0");
    setSlotDates([""]);
  }

  async function post(payload: unknown) {
    setError(null);
    setPending(true);
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
      posthog.capture("pool_credit_added", {
        credit_kind: kind,
        slot_count: kind === "ground_booking" ? slotCount : undefined,
      });
      onOpenChange(false);
      resetForm();
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (kind === "ground_booking") {
      const paid = Number(amountPaid) || 0;
      const owed = Number(amountPending) || 0;
      if (!teamName.trim() || !captain.trim()) {
        setError("Enter the team name and captain.");
        return;
      }
      if (slotCount < 1) {
        setError("Book at least one slot.");
        return;
      }
      if (slotDates.some((d) => !d)) {
        setError("Pick a date for every booked slot.");
        return;
      }
      if (paid + owed <= 0) {
        setError("Paid and pending amounts cannot both be zero.");
        return;
      }
      await post({
        kind,
        team_name: teamName.trim(),
        captain: captain.trim(),
        slots: slotCount,
        amount_paid: paid,
        amount_pending: owed,
        match_dates: slotDates,
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
    await post({
      kind,
      amount: value,
      // Player-linked rows title themselves by player — message optional.
      message: message.trim() || undefined,
      player_id: playerLinked ? playerId : undefined,
      entry_date: date || undefined,
    });
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
          ? "Records the booking, credits what was paid, and schedules a match per booked date."
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
                placeholder="Andheri Warriors"
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
                  onChange={(e) => changeSlots(e.target.value)}
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

            <MoneyInput
              label="Amount pending"
              value={amountPending}
              onChange={setAmountPending}
            />

            {slotCount > 0 && (
              <div className="flex flex-col gap-2 rounded-md border border-accent-light bg-accent-light/40 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
                  Booked dates — one match is scheduled per slot
                </p>
                {slotDates.map((slotDate, i) => (
                  <label key={i} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-xs font-medium text-text-secondary">
                      Slot {i + 1}
                    </span>
                    <input
                      type="date"
                      value={slotDate}
                      onChange={(e) =>
                        setSlotDates((dates) =>
                          dates.map((d, x) => (x === i ? e.target.value : d)),
                        )
                      }
                      required
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            )}
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
              ? `Save booking${slotCount > 0 ? ` + schedule ${slotCount} ${slotCount === 1 ? "match" : "matches"}` : ""}`
              : kind === "opening_due"
                ? "Record due"
                : "Add credit"}
        </button>
      </form>
    </SheetShell>
  );
}
