"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SheetShell } from "@/components/shared/SheetShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StepResult } from "@/components/wizard/StepResult";
import { StepCosts } from "@/components/wizard/StepCosts";
import { StepPlayers } from "@/components/wizard/StepPlayers";
import { StepGuests } from "@/components/wizard/StepGuests";
import { StepCarAllowance } from "@/components/wizard/StepCarAllowance";
import { StepCars } from "@/components/wizard/StepCars";
import { StepFeePreview } from "@/components/wizard/StepFeePreview";
import { formatRupees } from "@/lib/format";
import type { GroundInfo } from "@/lib/grounds";
import { cn } from "@/lib/utils";
import {
  rowKey,
  type PreviewRow,
  type PreviewTotals,
  type WizardCosts,
  type WizardGuest,
  type WizardInitial,
  type WizardPlayer,
} from "@/components/wizard/wizardTypes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  opponent: string;
  matchDateLabel: string;
  players: WizardPlayer[]; // all active players
  mode: "complete" | "edit";
  // Resolved server-side from the team's ground list (lib/grounds.ts
  // resolveGroundInfo) — drives the Car fee step's prefill and label.
  groundInfo: GroundInfo;
  initial?: WizardInitial;
  // Pre-fills the Costs step's ground fee on completion; editable.
  // Away matches: the pool-fronted fee (linked debit's current amount)
  // — the recoup always reads the debit row, so edits can't double-count.
  // Home booking matches: this match's slot share of what the opponent
  // paid to book (paid + pending + cleared-pending).
  initialGroundFee?: number;
  // Tournament reuse (defaults preserve SG behavior exactly):
  apiBase?: string; // endpoint root; preview/abandon/submit derive from it
  hasGuests?: boolean; // false drops the Guests step (tournaments: no guests)
  hasCosts?: boolean; // false drops the Costs step (participation-fee model)
  hasPreview?: boolean; // false drops the Fee preview; Cars submits directly
  fundLabel?: string; // "pool" (SG) or "fund" (tournaments) in success copy
};

type StepKey =
  | "result"
  | "costs"
  | "players"
  | "guests"
  | "carFee"
  | "cars"
  | "preview";

// nextLabels are derived in buildSteps from whichever step follows.
const ALL_STEPS: { key: StepKey; title: string }[] = [
  { key: "result", title: "How did it go?" },
  { key: "costs", title: "Costs" },
  { key: "players", title: "Who played?" },
  { key: "guests", title: "Guests" },
  { key: "carFee", title: "Car fee" },
  { key: "cars", title: "Cars" },
  { key: "preview", title: "Fee preview" },
];

function buildSteps(hasGuests: boolean, hasCosts: boolean, hasPreview: boolean) {
  const dropped = new Set<StepKey>();
  if (!hasGuests) dropped.add("guests");
  if (!hasCosts) dropped.add("costs");
  if (!hasPreview) dropped.add("preview");
  const steps = ALL_STEPS.filter((s) => !dropped.has(s.key));
  // Each step's label points at whichever step actually follows it.
  return steps.map((s, i) => ({
    ...s,
    nextLabel:
      i < steps.length - 1
        ? `Next — ${steps[i + 1].title === "Who played?" ? "players" : steps[i + 1].title.toLowerCase()}`
        : "",
  }));
}

export function MatchWizard({
  open,
  onOpenChange,
  matchId,
  opponent,
  matchDateLabel,
  players,
  mode,
  groundInfo,
  initial,
  initialGroundFee,
  apiBase,
  hasGuests = true,
  hasCosts = true,
  hasPreview = true,
  fundLabel = "pool",
}: Props) {
  const router = useRouter();
  const base = apiBase ?? `/api/matches/${matchId}`;
  const steps = buildSteps(hasGuests, hasCosts, hasPreview);
  const LAST_STEP = steps.length;
  const [step, setStep] = useState(mode === "edit" ? LAST_STEP : 1);
  // Bounds-hardened: a future dynamic-prop caller must not crash the render.
  const stepIndex = Math.min(step, LAST_STEP) - 1;
  const stepKey = steps[stepIndex].key;
  const [result, setResult] = useState<"won" | "lost" | null>(
    initial?.result ?? null,
  );
  const [abandonMode, setAbandonMode] = useState(false);
  const [abandonReason, setAbandonReason] = useState("");
  const [costs, setCosts] = useState<WizardCosts>(
    initial?.costs ?? {
      ground: initialGroundFee ? String(initialGroundFee) : "",
      ball: "60", // club default ball cost — editable like every prefill
      other: "0",
      allowance:
        groundInfo.allowance !== null ? String(groundInfo.allowance) : "",
    },
  );
  // Edit mode: a stored allowance of 0 means it was ignored (or genuinely
  // zero) — reflect that on the switch. Complete-mode blank must not.
  const [ignoreAllowance, setIgnoreAllowance] = useState(
    mode === "edit" && Number(initial?.costs.allowance) === 0,
  );
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initial?.selected ?? []),
  );
  const [cars, setCars] = useState<Set<string>>(new Set(initial?.cars ?? []));
  const [guests, setGuests] = useState<WizardGuest[]>(initial?.guests ?? []);
  const [baseRows, setBaseRows] = useState<PreviewRow[] | null>(null);
  const [totals, setTotals] = useState<PreviewTotals | null>(null);
  const [edits, setEdits] = useState<Map<string, number>>(
    new Map(Object.entries(initial?.fees ?? {})),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Guests count in the split too; their charges land on the captain.
  const attendees = [...selected].map((id) => ({
    player_id: id,
    brought_car: cars.has(id),
  }));

  const numericCosts = {
    ground_fee: Number(costs.ground) || 0,
    ball_fee: Number(costs.ball) || 0,
    other_fee: Number(costs.other) || 0,
    car_allowance_per_car: ignoreAllowance ? 0 : Number(costs.allowance) || 0,
  };
  const cashCosts =
    numericCosts.ground_fee + numericCosts.ball_fee + numericCosts.other_fee;

  // Edit mode opens directly on the preview step — load the engine baseline once.
  useEffect(() => {
    if (hasPreview && open && step === LAST_STEP && baseRows === null && !pending) {
      void loadPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, baseRows]);

  const displayRows = (baseRows ?? []).map((row) => {
    const key = rowKey(row);
    const edited = edits.get(key);
    return edited !== undefined ? { ...row, fee: edited } : row;
  });

  async function loadPreview() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${base}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...numericCosts, attendees, guests }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not calculate fees.");
        return false;
      }
      const rows = body.data.rows as PreviewRow[];
      setBaseRows(rows);
      // A stored fee equal to the engine's isn't an edit — drop it so the
      // edited-dot only marks true overrides.
      setEdits((current) => {
        const next = new Map(current);
        for (const row of rows) {
          const key = rowKey(row);
          if (next.get(key) === row.fee) next.delete(key);
        }
        return next;
      });
      setTotals({
        per_player_fee: body.data.per_player_fee,
        total_cost: body.data.total_cost,
        collected_total: body.data.collected_total,
        surplus_to_pool: body.data.surplus_to_pool,
        guest_rows: body.data.guest_rows ?? [],
        captain_charge: Number(body.data.captain_charge ?? 0),
        captain_name: body.data.captain_name ?? null,
      });
      return true;
    } catch {
      setError("Could not reach the server — check your connection.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function handleAbandon() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${base}/abandon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: abandonReason.trim() }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not abandon the match.");
        return;
      }
      const feeReverted = Number(body.data?.fee_reverted ?? 0);
      setSuccess(
        feeReverted > 0
          ? `Match marked abandoned — ₹${formatRupees(feeReverted)} ground fee returned to the ${fundLabel}.`
          : "Match marked abandoned — no fees charged.",
      );
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit() {
    if (!result) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        mode === "edit" ? base : `${base}/submit`,
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            result,
            ...numericCosts,
            // Without a preview there are no engine rows or fee edits —
            // attendance only (the participation-fee model settles later).
            rows: hasPreview
              ? displayRows
              : attendees.map((a) => ({ ...a, fee: 0 })),
            guests,
          }),
        },
      );
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not submit the match.");
        return;
      }
      if (!hasPreview) {
        // Attendance-only completion — no money copy.
        setSuccess(
          `Match recorded — ${selected.size} ${selected.size === 1 ? "player" : "players"}.`,
        );
        router.refresh();
        return;
      }
      const collected = Number(body.data.collected);
      const surplus = Number(body.data.surplus ?? collected - cashCosts);
      const guestFee = Number(body.data.guestFee ?? 0);
      const captainName = body.data.captainName as string | null;
      // Other matches recoup the pool-fronted ground fee on top of the
      // roundoff surplus; the toast shows the full credit either way.
      const recouped = Number(body.data.recouped ?? 0);
      const credited = Number(body.data.credited ?? Math.max(surplus, 0));
      setSuccess(
        `Collected ₹${formatRupees(collected)} · ${
          credited > 0
            ? recouped > 0
              ? `₹${formatRupees(credited)} credited to ${fundLabel} (₹${formatRupees(recouped)} ground fee recouped)`
              : `₹${formatRupees(credited)} surplus credited to ${fundLabel}`
            : `no surplus — nothing credited to ${fundLabel}`
        }${
          guestFee !== 0 && captainName
            ? ` · ₹${formatRupees(guestFee)} guest fees deducted from ${captainName}`
            : ""
        }`,
      );
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  async function goNext() {
    setError(null);
    if (stepKey === "result") {
      if (abandonMode) {
        if (!abandonReason.trim()) {
          setError("Enter the reason first.");
          return;
        }
        await handleAbandon();
        return;
      }
      if (!result) {
        setError("Pick Won or Lost.");
        return;
      }
      setStep(2);
      return;
    }
    if (stepKey === "players" && selected.size === 0) {
      setError("Select at least one player.");
      return;
    }
    if (step === LAST_STEP) {
      await handleSubmit();
      return;
    }
    if (hasPreview && step === LAST_STEP - 1) {
      if (await loadPreview()) setStep(LAST_STEP);
      return;
    }
    setStep(step + 1);
  }

  function goBack() {
    setError(null);
    // Fee edits only exist when there IS a fee preview.
    if (hasPreview && step === LAST_STEP && edits.size > 0) {
      setConfirmReset(true);
      return;
    }
    setStep(Math.max(1, step - 1));
  }

  function closeAndReset(openState: boolean) {
    onOpenChange(openState);
    if (!openState) {
      setSuccess(null);
      setError(null);
      // Drop the loaded preview so reopening recomputes from current
      // state — a stale baseline would silently submit pre-change rows.
      setBaseRows(null);
      setTotals(null);
      if (mode === "complete") setStep(1);
      else setStep(LAST_STEP);
    }
  }

  const selectedPlayers = players.filter((p) => selected.has(p.id));

  const wizardFooter = (
    <>
      {error && <p className="text-sm text-debit">{error}</p>}
      <div className="flex gap-2">
        {step > 1 && (
          <button
            type="button"
            onClick={goBack}
            disabled={pending}
            className="h-11 rounded-md border border-border bg-surface px-5 text-sm font-medium text-text-primary disabled:opacity-60"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={goNext}
          disabled={pending}
          className="h-11 flex-1 rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending
            ? "Working…"
            : stepKey === "result" && abandonMode
              ? "Submit abandonment"
              : steps[stepIndex].nextLabel ||
                (mode === "edit" ? "Save match" : "Submit match")}
        </button>
      </div>
    </>
  );

  return (
    <>
      <SheetShell
        open={open}
        onOpenChange={closeAndReset}
        title={success ? "Done" : steps[stepIndex].title}
        description={
          success ? undefined : `vs ${opponent} · ${matchDateLabel}`
        }
        footer={success ? undefined : wizardFooter}
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
          <>
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

            {stepKey === "result" && (
              <StepResult
                result={result}
                onResult={setResult}
                abandonMode={abandonMode}
                onAbandonMode={setAbandonMode}
                abandonReason={abandonReason}
                onAbandonReason={setAbandonReason}
              />
            )}
            {stepKey === "costs" && <StepCosts costs={costs} onChange={setCosts} />}
            {stepKey === "players" && (
              <StepPlayers
                players={players}
                selected={selected}
                onToggle={(id) => {
                  const next = new Set(selected);
                  if (next.has(id)) {
                    next.delete(id);
                    const nextCars = new Set(cars);
                    nextCars.delete(id);
                    setCars(nextCars);
                  } else {
                    next.add(id);
                  }
                  setSelected(next);
                }}
              />
            )}
            {stepKey === "guests" && (
              <StepGuests
                guests={guests}
                onAddGuest={(name) =>
                  setGuests([...guests, { name, brought_car: false }])
                }
                onRemoveGuest={(i) => setGuests(guests.filter((_, x) => x !== i))}
                onToggleCar={(i) =>
                  setGuests(
                    guests.map((g, x) =>
                      x === i ? { ...g, brought_car: !g.brought_car } : g,
                    ),
                  )
                }
              />
            )}
            {stepKey === "carFee" && (
              <StepCarAllowance
                groundLabel={groundInfo.label}
                known={groundInfo.known}
                allowance={costs.allowance}
                onAllowanceChange={(v) => setCosts({ ...costs, allowance: v })}
                ignored={ignoreAllowance}
                onIgnoredChange={setIgnoreAllowance}
              />
            )}
            {stepKey === "cars" && (
              <StepCars
                players={selectedPlayers}
                cars={cars}
                onToggleCar={(id) => {
                  const next = new Set(cars);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  setCars(next);
                }}
                allowance={numericCosts.car_allowance_per_car}
              />
            )}
            {stepKey === "preview" && totals && (
              <StepFeePreview
                rows={displayRows}
                players={players}
                editedKeys={new Set(edits.keys())}
                onEditFee={(key, fee) => {
                  const next = new Map(edits);
                  next.set(key, fee);
                  setEdits(next);
                }}
                onResetEdits={() => setEdits(new Map())}
                perPlayerFee={totals.per_player_fee}
                totalCost={totals.total_cost}
                cashCosts={cashCosts}
                guestRows={totals.guest_rows}
                captainCharge={totals.captain_charge}
                captainName={totals.captain_name}
                fundLabel={fundLabel}
              />
            )}

          </>
        )}
      </SheetShell>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Discard fee edits?"
        description="Going back recalculates every amount — your manual edits will be reset."
        confirmLabel="Discard and go back"
        destructive
        onConfirm={() => {
          setEdits(new Map());
          setConfirmReset(false);
          setStep(LAST_STEP - 1);
        }}
      />
    </>
  );
}
