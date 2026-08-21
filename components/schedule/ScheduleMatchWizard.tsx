"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SheetShell } from "@/components/shared/SheetShell";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Switch } from "@/components/ui/switch";
import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const LAST_STEP = 3;

const STEP_TITLES = ["Schedule match", "Match details", "Pool movement"];

const inputClass =
  "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

// The scheduling form, one decision per screen: when and where, then who
// and how much, then which way the money moves.
//
// The quick case finishes on screen 1 — a bare date and ground with the
// details switch off schedules a match with no opponent and no pool
// entry, which the card marks with a red dot. Turning the switch on
// disables that button, so Next becomes the only way forward.
//
// Pending lives on screen 2 but the direction on screen 3, so Pending is
// deliberately NOT gated on a direction here (the edit sheet, where both
// sit together, still gates it). The settled/pending split is computed
// at submit, once both are known.
export function ScheduleMatchWizard({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [detailsOn, setDetailsOn] = useState(false);
  const [opponentOn, setOpponentOn] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [fee, setFee] = useState("");
  const [credit, setCredit] = useState(false);
  const [debit, setDebit] = useState(false);
  const [pendingOn, setPendingOn] = useState(false);
  const [pendingAmount, setPendingAmount] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function closeAndReset(openState: boolean) {
    onOpenChange(openState);
    if (!openState) {
      setStep(1);
      setDate("");
      setVenue("");
      setDetailsOn(false);
      setOpponentOn(false);
      setOpponent("");
      setFee("");
      setCredit(false);
      setDebit(false);
      setPendingOn(false);
      setPendingAmount("");
      setError(null);
      setSuccess(null);
    }
  }

  // Credit and Debit are one direction of travel — turning either on
  // clears the other rather than letting both read as active. Pending is
  // NOT reset here: it lives on the previous screen, and silently wiping
  // a value the admin cannot see would be worse than leaving it.
  const hasDirection = credit || debit;

  function toggleCredit(on: boolean) {
    setCredit(on);
    if (on) setDebit(false);
  }
  function toggleDebit(on: boolean) {
    setDebit(on);
    if (on) setCredit(false);
  }

  const feeAmount = Number(fee) || 0;
  const pendingValue = pendingOn ? Number(pendingAmount) || 0 : 0;

  // Each screen refuses to advance until its own fields are complete, so
  // nothing invalid ever reaches the next one.
  const canLeaveStep1 = !!date && !!venue.trim();
  const canLeaveStep2 =
    feeAmount > 0 &&
    (!opponentOn || !!opponent.trim()) &&
    (!pendingOn || (pendingValue > 0 && pendingValue <= feeAmount));

  async function handleSubmit() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_date: date,
          venue: venue.trim(),
          ...(detailsOn && opponentOn ? { opponent: opponent.trim() } : {}),
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
        setError(body.error?.message ?? "Could not schedule — try again.");
        return;
      }
      const settled = feeAmount - pendingValue;
      setSuccess(
        !detailsOn
          ? "Match scheduled — add the opponent when you know it"
          : settled > 0
            ? `Match scheduled · ₹${formatRupees(settled)} ${credit ? "credited to" : "debited from"} the pool`
            : `Match scheduled · ₹${formatRupees(pendingValue)} pending`,
      );
      router.refresh();
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
  ) => (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-surface-secondary px-3 py-2">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className={checkedClass}
      />
    </label>
  );

  const backButton = (
    <button
      type="button"
      onClick={() => {
        setError(null);
        setStep((s) => (s === 3 ? 2 : 1));
      }}
      disabled={working}
      className="h-11 rounded-md border border-border bg-surface px-5 text-sm font-medium text-text-primary disabled:opacity-60"
    >
      Back
    </button>
  );

  const primaryClass =
    "h-11 flex-1 rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50";

  const footer = success ? undefined : (
    <>
      {error && <p className="text-sm text-debit">{error}</p>}
      <div className="flex gap-2">
        {step > 1 && backButton}

        {step === 1 && (
          <>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={working || detailsOn || !canLeaveStep1}
              className={primaryClass}
            >
              {working ? "Working…" : "Schedule a match"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep(2);
              }}
              disabled={!detailsOn || !canLeaveStep1}
              className={primaryClass}
            >
              Next
            </button>
          </>
        )}

        {step === 2 && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep(3);
            }}
            disabled={!canLeaveStep2}
            className={primaryClass}
          >
            Next
          </button>
        )}

        {step === 3 && (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={working || !hasDirection}
            className={primaryClass}
          >
            {working ? "Working…" : "Schedule Match"}
          </button>
        )}
      </div>
    </>
  );

  return (
    <SheetShell
      open={open}
      onOpenChange={closeAndReset}
      title={success ? "Done" : STEP_TITLES[step - 1]}
      description={
        success
          ? undefined
          : "The card appears publicly on the matches page right away."
      }
      footer={footer}
    >
      {success ? (
        <div className="flex flex-col gap-4 py-2">
          <p className="text-center text-lg font-semibold text-credit">
            {success}
          </p>
          <button
            type="button"
            onClick={() => closeAndReset(false)}
            className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground"
          >
            Close
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
              Step {step} of {LAST_STEP}
            </span>
            <span className="flex gap-1.5">
              {Array.from({ length: LAST_STEP }, (_, i) => i + 1).map((s) => (
                <span
                  key={s}
                  className={cn(
                    "size-[7px] rounded-full",
                    s === step ? "bg-accent" : "bg-border",
                  )}
                />
              ))}
            </span>
          </div>

          {step === 1 && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-text-secondary">
                  Date
                </span>
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
                  placeholder="Pimpri Turf"
                  required
                  className={inputClass}
                />
              </label>

              {switchRow("Match details", detailsOn, setDetailsOn)}

              <p className="text-xs text-text-muted">
                {detailsOn
                  ? "Continue to add the opponent and the fee."
                  : "Leave this off to put the date on the calendar now — the card is marked until an opponent is added."}
              </p>
            </>
          )}

          {step === 2 && (
            <>
              {switchRow("Opponent", opponentOn, setOpponentOn)}

              {opponentOn && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-text-secondary">
                    Opponent Name
                  </span>
                  <input
                    type="text"
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                    placeholder="Borivali Blasters"
                    required
                    className={inputClass}
                  />
                </label>
              )}

              <MoneyInput label="Fee" value={fee} onChange={setFee} required />

              {switchRow(
                "Pending",
                pendingOn,
                setPendingOn,
                "data-[state=checked]:bg-low",
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
                  Pending is off — the fee counts as fully paid.
                </p>
              )}
            </>
          )}

          {step === 3 && (
            <>
              {switchRow(
                "Credit to Pool",
                credit,
                toggleCredit,
                "data-[state=checked]:bg-credit",
              )}
              {switchRow(
                "Debit from Pool",
                debit,
                toggleDebit,
                "data-[state=checked]:bg-debit",
              )}

              <p className="text-xs text-text-muted">
                {hasDirection
                  ? pendingValue > 0
                    ? `₹${formatRupees(feeAmount - pendingValue)} ${credit ? "credited to" : "debited from"} the pool now · ₹${formatRupees(pendingValue)} pending.`
                    : `₹${formatRupees(feeAmount)} ${credit ? "credited to" : "debited from"} the pool.`
                  : "Choose which way the fee moves to finish."}
              </p>
            </>
          )}
        </div>
      )}
    </SheetShell>
  );
}
