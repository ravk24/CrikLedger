"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { SheetShell } from "@/components/shared/SheetShell";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { GroundSelect, OTHER_GROUND } from "@/components/shared/GroundSelect";
import { Switch } from "@/components/ui/switch";
import { formatRupees } from "@/lib/format";
import type { Ground } from "@/lib/grounds";

type PaidTo = "opponent" | "owner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grounds: Ground[]; // team ground list for the venue select
  // Standing captain (players.is_captain) for the paid-to-owner note.
  captainName: string | null;
};

// Two-step away-match scheduler. Step 1 records WHO received
// our team's ground share (mutually exclusive switches — one is
// required; the owner case gates Next behind an explicit
// "I understand" because only OUR contribution may be entered, the
// opponent's share flows offline to the captain). Step 2 is the
// familiar schedule form plus the contribution amount; submit creates
// the match and the pool debit in one transaction.
export function OtherScheduleWizard({
  open,
  onOpenChange,
  grounds,
  captainName,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [paidTo, setPaidTo] = useState<PaidTo | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [date, setDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [groundChoice, setGroundChoice] = useState("");
  const [customName, setCustomName] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const needsUnderstanding = paidTo === "owner" && !understood;
  const canProceed = paidTo !== null && !needsUnderstanding;

  function setPaidToOpponent(on: boolean) {
    setPaidTo(on ? "opponent" : null);
  }
  function setPaidToOwner(on: boolean) {
    setPaidTo(on ? "owner" : null);
    if (!on) setUnderstood(false);
  }

  function closeAndReset(openState: boolean) {
    onOpenChange(openState);
    if (!openState) {
      setStep(1);
      setPaidTo(null);
      setUnderstood(false);
      setDate("");
      setOpponent("");
      setGroundChoice("");
      setCustomName("");
      setAmount("");
      setError(null);
      setSuccess(null);
    }
  }

  async function handleSubmit() {
    const feeAmount = Number(amount);
    const venue =
      groundChoice === OTHER_GROUND ? customName.trim() : groundChoice;
    if (!date || !opponent.trim()) {
      setError("Enter the match date and opponent.");
      return;
    }
    if (!groundChoice) {
      setError("Choose the ground.");
      return;
    }
    if (groundChoice === OTHER_GROUND && !customName.trim()) {
      setError("Enter the ground name.");
      return;
    }
    if (!feeAmount || feeAmount <= 0) {
      setError("Enter the fee amount paid.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_date: date,
          opponent: opponent.trim(),
          ground: "away",
          ...(venue ? { venue } : {}),
          fee_paid_to: paidTo,
          fee_amount: feeAmount,
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not schedule — try again.");
        return;
      }
      setSuccess(
        `Match scheduled · ₹${formatRupees(feeAmount)} ground fee debited from the pool`,
      );
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  const switchRow = (
    label: string,
    checked: boolean,
    disabled: boolean,
    onChange: (on: boolean) => void,
  ) => (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-surface-secondary px-3 py-2">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );

  const footer = success ? undefined : (
    <>
      {error && <p className="text-sm text-debit">{error}</p>}
      <div className="flex gap-2">
        {step === 2 && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep(1);
            }}
            disabled={pending}
            className="h-11 rounded-md border border-border bg-surface px-5 text-sm font-medium text-text-primary disabled:opacity-60"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (step === 1) {
              setError(null);
              setStep(2);
            } else {
              void handleSubmit();
            }
          }}
          disabled={pending || (step === 1 && !canProceed)}
          className="h-11 flex-1 rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Working…"
            : step === 1
              ? "Next — schedule match"
              : "Schedule match"}
        </button>
      </div>
    </>
  );

  return (
    <SheetShell
      open={open}
      onOpenChange={closeAndReset}
      title={success ? "Done" : step === 1 ? "Match fee" : "Schedule away match"}
      description={
        success
          ? undefined
          : step === 1
            ? "Who received our team's ground fee?"
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
      ) : step === 1 ? (
        <div className="flex flex-col gap-3">
          {switchRow(
            "Paid to Opponent",
            paidTo === "opponent",
            paidTo === "owner",
            setPaidToOpponent,
          )}
          {switchRow(
            "Paid to ground owner",
            paidTo === "owner",
            paidTo === "opponent",
            setPaidToOwner,
          )}

          {paidTo === "owner" && (
            <div className="flex flex-col gap-2 rounded-md bg-low-light p-3">
              <p className="text-sm text-low-foreground">
                <span className="font-semibold">Note:</span> The opponent is
                supposed to transfer Fee to{" "}
                {captainName ? `${captainName} (c)` : "the captain"}. Enter
                only our team&apos;s fee contribution.
              </p>
              <button
                type="button"
                onClick={() => setUnderstood(true)}
                disabled={understood}
                className={
                  understood
                    ? "flex h-10 items-center justify-center gap-1.5 rounded-md border border-credit bg-credit-light text-sm font-medium text-credit-foreground"
                    : "h-10 rounded-md border border-border bg-surface text-sm font-medium text-text-primary"
                }
              >
                {understood ? (
                  <>
                    <Check size={16} />
                    Understood
                  </>
                ) : (
                  "I understand"
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Match date
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
              Opponent
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
          <GroundSelect
            grounds={grounds}
            choice={groundChoice}
            customName={customName}
            onChoiceChange={setGroundChoice}
            onCustomNameChange={setCustomName}
          />
          <MoneyInput
            label={
              paidTo === "owner"
                ? "Team fee contribution"
                : "Fee paid to opponent"
            }
            value={amount}
            onChange={setAmount}
            required
          />
          <p className="text-xs text-text-muted">
            This amount is debited from the pool now and recouped from
            player match fees when the match is completed. Abandoning or
            cancelling the match returns it to the pool.
          </p>
        </div>
      )}
    </SheetShell>
  );
}
