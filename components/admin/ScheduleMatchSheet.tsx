"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SheetShell } from "@/components/shared/SheetShell";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The match being fixed. feeAmount is the whole fee (settled +
  // pending), which is what the form edits — the server splits it again
  // on save.
  editing: {
    matchId: string;
    date: string;
    opponent: string | null;
    venue: string | null;
    feeAmount: number;
    feeDirection: "credit" | "debit" | null;
    feePending: number;
  };
};

const inputClass =
  "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

// Edit a scheduled match. Mirrors the scheduling form field for field,
// because this is where a bare-date match gains its opponent and its fee.
export function ScheduleMatchSheet({ open, onOpenChange, editing }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(editing.date);
  const [venue, setVenue] = useState(editing.venue ?? "");
  const [opponent, setOpponent] = useState(editing.opponent ?? "");
  const [detailsOn, setDetailsOn] = useState(editing.feeDirection !== null);
  const [fee, setFee] = useState(
    editing.feeAmount ? String(Math.round(editing.feeAmount)) : "",
  );
  const [credit, setCredit] = useState(editing.feeDirection === "credit");
  const [debit, setDebit] = useState(editing.feeDirection === "debit");
  const [pendingOn, setPendingOn] = useState(
    editing.feeDirection !== null && editing.feePending > 0,
  );
  const [pendingAmount, setPendingAmount] = useState(
    editing.feePending ? String(Math.round(editing.feePending)) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const {
    date: editDate,
    opponent: editOpponent,
    venue: editVenue,
    feeAmount: editFee,
    feeDirection: editDirection,
    feePending: editPending,
  } = editing;
  // Re-seed on every open: the sheet stays mounted between edits, so
  // stale state would otherwise survive a save-and-reopen.
  useEffect(() => {
    if (!open) return;
    setDate(editDate);
    setVenue(editVenue ?? "");
    setOpponent(editOpponent ?? "");
    setDetailsOn(editDirection !== null);
    setFee(editFee ? String(Math.round(editFee)) : "");
    setCredit(editDirection === "credit");
    setDebit(editDirection === "debit");
    setPendingOn(editDirection !== null && editPending > 0);
    setPendingAmount(editPending ? String(Math.round(editPending)) : "");
    setError(null);
  }, [
    open,
    editDate,
    editOpponent,
    editVenue,
    editFee,
    editDirection,
    editPending,
  ]);

  // Pending is a slice of an amount that has to move somewhere, so it
  // is only reachable once a direction exists.
  const hasDirection = credit || debit;
  // A direction only makes sense once there is a non-zero fee to move.
  const hasFee = (Number(fee) || 0) > 0;

  function clearPending() {
    setPendingOn(false);
    setPendingAmount("");
  }

  // Clearing the fee (or typing 0) withdraws the direction and pending
  // with it, so the disabled switches never show a stale "on".
  function handleFeeChange(value: string) {
    setFee(value);
    if ((Number(value) || 0) <= 0) {
      setCredit(false);
      setDebit(false);
      clearPending();
    }
  }

  // Credit and Debit are one direction of travel — turning either on
  // clears the other. Pending resets only when NO direction is left:
  // swapping Credit <-> Debit must not wipe a typed amount.
  function toggleCredit(on: boolean) {
    setCredit(on);
    if (on) setDebit(false);
    else if (!debit) clearPending();
  }
  function toggleDebit(on: boolean) {
    setDebit(on);
    if (on) setCredit(false);
    else if (!credit) clearPending();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const groundName = venue.trim();
    const feeAmount = Number(fee) || 0;
    const pendingValue = pendingOn ? Number(pendingAmount) || 0 : 0;

    if (!opponent.trim()) {
      setError("Enter the opponent name.");
      return;
    }
    if (detailsOn) {
      if (feeAmount <= 0) {
        setError("Enter the fee amount.");
        return;
      }
      if (!credit && !debit) {
        setError("Choose Credit to Pool or Debit from Pool.");
        return;
      }
      if (pendingOn && pendingValue <= 0) {
        setError("Enter the pending amount.");
        return;
      }
      if (pendingValue > feeAmount) {
        setError("Pending amount cannot exceed the fee.");
        return;
      }
    }

    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${editing.matchId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_date: date,
          ...(groundName ? { venue: groundName } : {}),
          opponent: opponent.trim(),
          ...(detailsOn
            ? {
                fee_amount: feeAmount,
                fee_direction: credit ? "credit" : "debit",
                fee_pending: pendingValue,
              }
            : {}),
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not save — try again.");
        return;
      }
      onOpenChange(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setWorking(false);
    }
  }

  const switchRow = (
    label: string,
    checked: boolean,
    onChange: (on: boolean) => void,
    checkedClass?: string,
    disabled = false,
  ) => (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-surface-secondary px-3 py-2">
      <span
        className={cn(
          "text-sm font-medium",
          disabled ? "text-text-muted" : "text-text-primary",
        )}
      >
        {label}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className={checkedClass}
      />
    </label>
  );

  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      title="Edit schedule"
      description="Fix the date, ground, opponent or fee — the public card updates right away."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            Ground
          </span>
          <input
            type="text"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Ground name"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            Opponent Name
          </span>
          <input
            type="text"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="Opponent team name"
            required
            className={inputClass}
          />
        </label>

        {switchRow("Match details", detailsOn, setDetailsOn)}

        {detailsOn && (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-surface shadow-card p-3">
            <MoneyInput
              label="Fee"
              value={fee}
              onChange={handleFeeChange}
              required
            />

            {switchRow(
              "Credit to Pool",
              credit,
              toggleCredit,
              "data-[state=checked]:bg-credit",
              !hasFee,
            )}
            {switchRow(
              "Debit from Pool",
              debit,
              toggleDebit,
              "data-[state=checked]:bg-debit",
              !hasFee,
            )}
            {switchRow(
              "Pending",
              pendingOn,
              setPendingOn,
              "data-[state=checked]:bg-low",
              !hasDirection,
            )}

            {pendingOn ? (
              <MoneyInput
                label="Pending Amount"
                value={pendingAmount}
                onChange={setPendingAmount}
                required
              />
            ) : (
              <p className="text-xs text-text-muted">
                {hasDirection
                  ? "Pending is off — the fee counts as fully paid."
                  : hasFee
                    ? "Choose Credit or Debit first."
                    : "Enter the fee first."}
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-debit">{error}</p>}
        <button
          type="submit"
          disabled={working || (detailsOn && !hasDirection)}
          className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {working ? "Saving…" : "Save changes"}
        </button>
      </form>
    </SheetShell>
  );
}
