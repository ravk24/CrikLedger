"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SheetShell } from "@/components/shared/SheetShell";
import { StepResult } from "@/components/wizard/StepResult";
import { StepCosts } from "@/components/wizard/StepCosts";
import { StepPlayers } from "@/components/wizard/StepPlayers";
import { StepGuests } from "@/components/wizard/StepGuests";
import { StepCarAllowance } from "@/components/wizard/StepCarAllowance";
import { StepCars } from "@/components/wizard/StepCars";
import { StepSharedCar } from "@/components/wizard/StepSharedCar";
import { StepFeePreview } from "@/components/wizard/StepFeePreview";
import { calculateMatchFees, type MatchFeeResult } from "@/engine/calc";
import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
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
  // The match's ground name ("" when none was recorded) — labels the
  // Car fee step. There is no allowance prefill any more: the grounds
  // list it came from was dropped (dropped-home_match-feature.md).
  groundLabel: string;
  initial?: WizardInitial;
  // Pre-fills the Costs step's ground fee on completion; editable.
  // Migration-36 matches: the opponent's full fee — settled entry +
  // still-pending + cleared-pending entry (migration 41 link).
  // Editable: the recoup reads the debit row, so edits can't double-count.
  initialGroundFee?: number;
  // Tournament reuse (defaults preserve SG behavior exactly):
  apiBase?: string; // endpoint root; preview/abandon/submit derive from it
  hasGuests?: boolean; // false drops the Guests step (tournaments: no guests)
  hasCosts?: boolean; // false drops the Costs step (participation-fee model)
  hasPreview?: boolean; // false drops the Fee preview; Cars submits directly
  hasSharing?: boolean; // false drops "Who shared the car"
  fundLabel?: string; // "pool" (SG) or "fund" (tournaments) in success copy
};

type StepKey =
  | "result"
  | "costs"
  | "players"
  | "guests"
  | "carFee"
  | "cars"
  | "shared"
  | "preview";

// nextLabels are derived in buildSteps from whichever step follows.
const ALL_STEPS: { key: StepKey; title: string }[] = [
  { key: "result", title: "How did it go?" },
  { key: "costs", title: "Costs" },
  { key: "players", title: "Who played?" },
  { key: "guests", title: "Guests" },
  { key: "carFee", title: "Car fee" },
  { key: "cars", title: "Who brought the car" },
  { key: "shared", title: "Who shared the car" },
  { key: "preview", title: "Fee preview" },
];

function buildSteps(
  hasGuests: boolean,
  hasCosts: boolean,
  hasPreview: boolean,
  hasSharing: boolean,
  ignoreAllowance: boolean,
) {
  const dropped = new Set<StepKey>();
  if (!hasGuests) dropped.add("guests");
  if (!hasCosts) dropped.add("costs");
  if (!hasPreview) dropped.add("preview");
  // No sharing step for callers that do not ask the question. And
  // ignoring the car fee drops BOTH car questions: with no rebate to
  // hand out, neither decides anything.
  if (!hasSharing) dropped.add("shared");
  if (ignoreAllowance) {
    dropped.add("cars");
    dropped.add("shared");
  }
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

// Everyone shares a car unless unticked, so the wizard tracks the
// EXCEPTIONS: the people who made their own way. Edit mode rebuilds that
// set from what was stored (drivers are stored as sharers, so they never
// land in it).
function initialOwnWay(initial: WizardInitial | undefined): Set<string> {
  if (!initial) return new Set();
  const cars = new Set(initial.cars);
  const shared = new Set(initial.shared);
  return new Set(
    initial.selected.filter((id) => !cars.has(id) && !shared.has(id)),
  );
}

export function MatchWizard({
  open,
  onOpenChange,
  matchId,
  opponent,
  matchDateLabel,
  players,
  mode,
  groundLabel,
  initial,
  initialGroundFee,
  apiBase,
  hasGuests = true,
  hasCosts = true,
  hasPreview = true,
  hasSharing = true,
  fundLabel = "pool",
}: Props) {
  const router = useRouter();
  const base = apiBase ?? `/api/matches/${matchId}`;
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
      allowance: "",
    },
  );
  // Edit mode: a stored allowance of 0 means it was ignored (or genuinely
  // zero) — reflect that on the switch. Complete-mode blank must not.
  const [ignoreAllowance, setIgnoreAllowance] = useState(
    mode === "edit" && Number(initial?.costs.allowance) === 0,
  );
  // 1-based; clamped against the step list below, which can shrink.
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initial?.selected ?? []),
  );
  const [cars, setCars] = useState<Set<string>>(new Set(initial?.cars ?? []));
  const [ownWay, setOwnWay] = useState<Set<string>>(() =>
    initialOwnWay(initial),
  );
  const [guests, setGuests] = useState<WizardGuest[]>(initial?.guests ?? []);
  const [baseRows, setBaseRows] = useState<PreviewRow[] | null>(null);
  const [totals, setTotals] = useState<PreviewTotals | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // The step list depends on the ignore switch, so it is built after it.
  const steps = buildSteps(
    hasGuests,
    hasCosts,
    hasPreview,
    hasSharing,
    ignoreAllowance,
  );
  const LAST_STEP = steps.length;
  // Bounds-hardened: the list shrinks when the ignore switch goes on, and
  // a future dynamic-prop caller must not crash the render either.
  const stepIndex = Math.min(step, LAST_STEP) - 1;
  const stepKey = steps[stepIndex].key;

  // Guests count in the split too; their charges land on the captain.
  // shared_car = rode in a car: a driver always did, everyone else did
  // unless they were unticked on the sharing step.
  const attendees = [...selected].map((id) => ({
    player_id: id,
    brought_car: cars.has(id),
    shared_car: cars.has(id) || !ownWay.has(id),
  }));

  const numericCosts = {
    ground_fee: Number(costs.ground) || 0,
    ball_fee: Number(costs.ball) || 0,
    other_fee: Number(costs.other) || 0,
    car_allowance_per_car: ignoreAllowance ? 0 : Number(costs.allowance) || 0,
  };
  const cashCosts =
    numericCosts.ground_fee + numericCosts.ball_fee + numericCosts.other_fee;

  // The fee split is the pure engine (engine/calc.ts) run right here —
  // the same module the guest sample uses — so stepping through the
  // wizard costs no round-trip. Submit still recomputes on the server,
  // which stays the authority for what is written.
  function runEngine(): MatchFeeResult {
    return calculateMatchFees({
      groundFee: numericCosts.ground_fee,
      ballFee: numericCosts.ball_fee,
      otherFee: numericCosts.other_fee,
      carAllowancePerCar: numericCosts.car_allowance_per_car,
      attendees: attendees.map((a) => ({
        playerId: a.player_id,
        broughtCar: a.brought_car,
        sharedCar: a.shared_car,
      })),
      guests: guests.map((g) => ({
        name: g.name,
        broughtCar: g.brought_car,
        sharedCar: g.shared_car,
      })),
    });
  }
  // Live figures for the sharing step's caption (NO_PLAYERS → null).
  let live: MatchFeeResult | null = null;
  try {
    live = selected.size > 0 ? runEngine() : null;
  } catch {
    live = null;
  }

  // Edit mode opens directly on the preview step — load the engine baseline once.
  useEffect(() => {
    if (hasPreview && open && step === LAST_STEP && baseRows === null && !pending) {
      void loadPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, baseRows]);

  // Kept async/boolean so the callers' shape did not change.
  async function loadPreview() {
    setError(null);
    const captain = players.find((p) => p.is_captain) ?? null;
    if (guests.length > 0 && !captain) {
      setError(
        "Declare a captain first (superadmin → Players) — guest fees are deducted from the captain",
      );
      return false;
    }
    try {
      const result = runEngine();
      setBaseRows(
        result.rows.map((r) => ({
          player_id: r.playerId,
          brought_car: r.broughtCar,
          shared_car: r.sharedCar,
          fee: r.fee,
        })),
      );
      setTotals({
        per_player_fee: result.perPlayerFee,
        car_share_per_sharer: result.carSharePerSharer,
        sharer_count: result.sharerCount,
        own_way_count: result.ownWayCount,
        car_count: result.carCount,
        total_cost: result.totalCost,
        cash_costs: result.cashCosts,
        collected_total: result.collectedTotal,
        surplus_to_pool: result.surplusToPool,
        guest_rows: result.guestRows.map((g) => ({
          name: g.name,
          brought_car: g.broughtCar,
          shared_car: g.sharedCar,
          fee: g.fee,
        })),
        captain_charge: result.captainCharge,
        captain_name: captain?.name ?? null,
      });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not calculate fees.");
      return false;
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
      startTransition(() => router.refresh());
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
            // Attendance only — the server computes every fee from these
            // and the costs. It never takes a fee from the client.
            rows: attendees,
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
        startTransition(() => router.refresh());
        return;
      }
      const collected = Number(body.data.collected);
      const surplus = Number(body.data.surplus ?? collected - cashCosts);
      // Other matches recoup the pool-fronted ground fee on top of the
      // roundoff surplus; the toast shows the full credit either way.
      // No guest-fee sentence: guests paying the captain is a standing
      // team rule (Ravi 2026-08-25).
      const recouped = Number(body.data.recouped ?? 0);
      const credited = Number(body.data.credited ?? Math.max(surplus, 0));
      setSuccess(
        `Collected ₹${formatRupees(collected)} · ${
          credited > 0
            ? recouped > 0
              ? `₹${formatRupees(credited)} credited to ${fundLabel} (₹${formatRupees(recouped)} ground fee recouped)`
              : `₹${formatRupees(credited)} surplus credited to ${fundLabel}`
            : `no surplus — nothing credited to ${fundLabel}`
        }`,
      );
      startTransition(() => router.refresh());
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
  const sharedPlayers = new Set(
    selectedPlayers
      .filter((p) => !cars.has(p.id) && !ownWay.has(p.id))
      .map((p) => p.id),
  );

  const wizardFooter = (
    <>
      {error && <p className="text-sm text-debit">{error}</p>}
      <div className="flex gap-2">
        {step > 1 && (
          <button
            type="button"
            onClick={goBack}
            disabled={pending}
            className="h-11 rounded-md border border-border bg-surface shadow-card px-5 text-sm font-medium text-text-primary disabled:opacity-60"
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
                    const nextOwnWay = new Set(ownWay);
                    nextOwnWay.delete(id);
                    setOwnWay(nextOwnWay);
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
                  setGuests([
                    ...guests,
                    // Shares by default, like everyone else.
                    { name, brought_car: false, shared_car: true },
                  ])
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
                groundLabel={groundLabel}
                known={false}
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
            {stepKey === "shared" && (
              <StepSharedCar
                players={selectedPlayers}
                cars={cars}
                shared={sharedPlayers}
                onToggleShared={(id) => {
                  const next = new Set(ownWay);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  setOwnWay(next);
                }}
                onSetAllShared={(on) => {
                  setOwnWay(
                    on
                      ? new Set()
                      : new Set(
                          selectedPlayers
                            .filter((p) => !cars.has(p.id))
                            .map((p) => p.id),
                        ),
                  );
                  setGuests(
                    guests.map((g) =>
                      g.brought_car ? g : { ...g, shared_car: on },
                    ),
                  );
                }}
                guests={guests}
                onToggleGuestShared={(i) =>
                  setGuests(
                    guests.map((g, x) =>
                      x === i ? { ...g, shared_car: !g.shared_car } : g,
                    ),
                  )
                }
                allowance={numericCosts.car_allowance_per_car}
                carCount={live?.carCount ?? 0}
                carSharePerSharer={live?.carSharePerSharer ?? 0}
                sharerCount={live?.sharerCount ?? 0}
              />
            )}
            {stepKey === "preview" && totals && (
              <StepFeePreview
                rows={baseRows ?? []}
                players={players}
                totals={totals}
                carAllowancePerCar={numericCosts.car_allowance_per_car}
                fundLabel={fundLabel}
              />
            )}

          </>
        )}
      </SheetShell>

    </>
  );
}
