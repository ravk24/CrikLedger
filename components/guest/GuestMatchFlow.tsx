"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, CloudRain, MapPin } from "lucide-react";
import { StepCarAllowance } from "@/components/wizard/StepCarAllowance";
import { StepCars } from "@/components/wizard/StepCars";
import { StepCosts } from "@/components/wizard/StepCosts";
import { StepFeePreview } from "@/components/wizard/StepFeePreview";
import { StepGuests } from "@/components/wizard/StepGuests";
import { StepPlayers } from "@/components/wizard/StepPlayers";
import { StepSharedCar } from "@/components/wizard/StepSharedCar";
import { StepResult } from "@/components/wizard/StepResult";
import { GuestMatchSheet } from "@/components/guest/GuestMatchSheet";
import { calculateMatchFees } from "@/engine/calc";
import { formatRupees } from "@/lib/format";
import {
  DEMO_COSTS,
  DEMO_DRIVERS,
  DEMO_PLAYERS,
  DEMO_TEAM,
} from "@/lib/demo/fixtures";
import type {
  WizardCosts,
  WizardGuest,
} from "@/components/wizard/wizardTypes";

// The free sample: complete a pre-made match and share the sheet.
//
// EVERYTHING here runs in the browser. There is no fetch, no
// router.refresh(), no DB write — the fee split comes from the same pure
// engine the paid flow uses (engine/calc.ts), and the numbers are
// identical for identical inputs. That is the point of the sample: it is
// the real calculation, on invented data.
//
// Deliberately NOT MatchWizard. That component's core is
// preview/submit/abandon network calls against a real match, and it is
// the money-critical path for paying teams; threading a guest flag
// through it would put sample-mode branches inside the one component
// that must never regress. What IS shared is every step component below,
// so the windows a visitor walks are the paid windows, not lookalikes:
// the seven of MatchWizard's ALL_STEPS, in the same order.
type Step =
  | "intro"
  | "result"
  | "costs"
  | "players"
  | "guests"
  | "carFee"
  | "cars"
  | "shared"
  | "preview"
  | "sheet";

// Mirrors MatchWizard's ALL_STEPS. "intro" (the scheduled-match card the
// paid flow reaches from the match page instead) and "sheet" sit outside
// the count, so the counter reads the same "step N of 7" a paying
// captain sees.
const ALL_STEPS: Step[] = [
  "intro",
  "result",
  "costs",
  "players",
  "guests",
  "carFee",
  "cars",
  "shared",
  "preview",
  "sheet",
];

// Ignoring the car fee drops BOTH car questions — with no rebate to give
// or fund, neither decides anything. The count shrinks with them rather
// than skipping numbers, which is how buildSteps() handles a dropped
// step in the paid wizard.
function buildSteps(ignoreAllowance: boolean): Step[] {
  return ignoreAllowance
    ? ALL_STEPS.filter((s) => s !== "cars" && s !== "shared")
    : ALL_STEPS;
}

// What the Next button points at. Derived from the step list rather than
// hardcoded per screen, so dropping the cars step relabels Car fee's
// button too — the paid wizard derives its labels the same way.
const STEP_NAMES: Record<Step, string> = {
  intro: "the match",
  result: "result",
  costs: "costs",
  players: "players",
  guests: "guests",
  carFee: "car fee",
  cars: "who brought the car",
  shared: "who shared the car",
  preview: "fee preview",
  sheet: "the match sheet",
};

const CAPTAIN = DEMO_PLAYERS.find((p) => p.is_captain) ?? null;

export function GuestMatchFlow() {
  const [step, setStep] = useState<Step>("intro");
  const [result, setResult] = useState<"won" | "lost" | null>("won");
  const [abandonMode, setAbandonMode] = useState(false);
  const [abandonReason, setAbandonReason] = useState("");
  const [abandoned, setAbandoned] = useState(false);
  const [costs, setCosts] = useState<WizardCosts>({ ...DEMO_COSTS });
  const [selected, setSelected] = useState<Set<string>>(
    new Set(DEMO_PLAYERS.map((p) => p.id)),
  );
  const [guests, setGuests] = useState<WizardGuest[]>([]);
  const [ignoreAllowance, setIgnoreAllowance] = useState(false);
  const [cars, setCars] = useState<Set<string>>(new Set(DEMO_DRIVERS));
  // Who rode with someone. Pre-filled with everyone who did not drive,
  // which is the common case and the same thing Include all does.
  const [shared, setShared] = useState<Set<string>>(
    new Set(
      DEMO_PLAYERS.filter(
        (p) => !(DEMO_DRIVERS as readonly string[]).includes(p.id),
      ).map((p) => p.id),
    ),
  );

  // The ignore switch never clears the typed amount, so toggling it off
  // restores it — same contract as StepCarAllowance's docs.
  const allowance = ignoreAllowance ? 0 : Number(costs.allowance) || 0;
  // Ignoring the fee ignores the cars too: no rebate, no car marks on the
  // preview, the sheet or the shared PNG.
  const effectiveCars = useMemo(
    () => (ignoreAllowance ? new Set<string>() : cars),
    [ignoreAllowance, cars],
  );

  const selectedPlayers = useMemo(
    () => DEMO_PLAYERS.filter((p) => selected.has(p.id)),
    [selected],
  );

  const fees = useMemo(() => {
    try {
      return calculateMatchFees({
        groundFee: Number(costs.ground) || 0,
        ballFee: Number(costs.ball) || 0,
        otherFee: Number(costs.other) || 0,
        carAllowancePerCar: allowance,
        attendees: selectedPlayers.map((p) => ({
          playerId: p.id,
          broughtCar: effectiveCars.has(p.id),
          sharedCar: shared.has(p.id),
        })),
        guests: guests.map((g) => ({
          name: g.name,
          broughtCar: g.brought_car,
          sharedCar: g.shared_car,
        })),
        // The team flow's rule: only the people who rode fund the cars.
        carSplit: "sharers",
      });
    } catch {
      // NO_PLAYERS: everyone was deselected. The preview step handles it.
      return null;
    }
  }, [costs, selectedPlayers, effectiveCars, shared, guests, allowance]);

  const displayRows = fees?.rows ?? [];

  const steps = buildSteps(ignoreAllowance);
  const wizardSteps = steps.length - 2; // intro and sheet sit outside the count
  // Turning the switch on while standing on the cars step would strand
  // the index; clamp to the last real step in that case.
  // A step that just left the list (cars, when the switch goes on while
  // standing on it) resolves to the step that now follows Car fee.
  const found = steps.indexOf(step);
  const index = found === -1 ? steps.indexOf("preview") : found;
  const back = () => setStep(steps[Math.max(0, index - 1)]);
  const next = () => setStep(steps[Math.min(steps.length - 1, index + 1)]);
  const nextStep = steps[Math.min(steps.length - 1, index + 1)];
  const nextLabel = `Next — ${STEP_NAMES[nextStep]}`;

  function toggleCar(playerId: string) {
    setCars((prev) => {
      const nextCars = new Set(prev);
      if (nextCars.has(playerId)) nextCars.delete(playerId);
      else nextCars.add(playerId);
      return nextCars;
    });
  }

  function restart() {
    setStep("intro");
    setAbandoned(false);
    setAbandonMode(false);
    setAbandonReason("");
    setResult("won");
    setCosts({ ...DEMO_COSTS });
    setSelected(new Set(DEMO_PLAYERS.map((p) => p.id)));
    setGuests([]);
    setIgnoreAllowance(false);
    setCars(new Set(DEMO_DRIVERS));
    setShared(
      new Set(
        DEMO_PLAYERS.filter(
          (p) => !(DEMO_DRIVERS as readonly string[]).includes(p.id),
        ).map((p) => p.id),
      ),
    );
  }

  // Abandoning skips every remaining step in the paid wizard too — there
  // is nothing to split, so the sample says so and offers a restart.
  if (abandoned) {
    return (
      <>
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            <CloudRain size={14} /> Abandoned
          </p>
          <h2 className="text-lg font-bold text-text-primary">
            {DEMO_TEAM.name} vs {DEMO_TEAM.opponent}
          </h2>
          <p className="text-sm text-text-secondary">
            No fees to split — everyone is charged nothing
            {abandonReason.trim() ? ` (${abandonReason.trim()})` : ""}. In a
            real ledger the ground fee stays with the pool and the match is
            closed.
          </p>
        </section>
        <button
          type="button"
          onClick={restart}
          className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground"
        >
          Start over
        </button>
        <p className="text-center text-xs text-text-muted">
          This is a sample. Nothing is saved.
        </p>
      </>
    );
  }

  if (step === "sheet" && fees) {
    return (
      <GuestMatchSheet
        result={fees}
        rows={displayRows}
        costs={costs}
        captainName={CAPTAIN?.name ?? null}
        onBack={() => setStep("preview")}
      />
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {index > 0 && (
          <button
            type="button"
            onClick={back}
            className="flex min-h-11 items-center gap-1 text-sm font-medium text-text-secondary"
          >
            <ChevronLeft size={16} /> Back
          </button>
        )}
        <span className="ml-auto text-xs text-text-muted">
          {index === 0
            ? "Sample"
            : `Sample · step ${index} of ${wizardSteps}`}
        </span>
      </div>

      {step === "intro" && (
        <>
          <section className="rounded-lg border border-border bg-surface p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-scheduled-foreground">
              Scheduled
            </p>
            <h2 className="mt-1 text-lg font-bold text-text-primary">
              {DEMO_TEAM.name} vs {DEMO_TEAM.opponent}
            </h2>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-text-secondary">
              <CalendarDays size={14} /> Sunday, 13 September 2026
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
              <MapPin size={14} /> {DEMO_TEAM.venue}
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              {DEMO_PLAYERS.length} players played. Walk the same steps a
              paying captain does and see how CrikLedger splits the cost —
              then share the result.
            </p>
          </section>
          <button
            type="button"
            onClick={next}
            className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground"
          >
            Complete the match
          </button>
          <p className="text-center text-xs text-text-muted">
            This is a sample. Nothing is saved.
          </p>
        </>
      )}

      {step === "result" && (
        <>
          <h2 className="text-base font-semibold text-text-primary">
            How did it go?
          </h2>
          <StepResult
            result={result}
            onResult={setResult}
            abandonReason={abandonReason}
            onAbandonReason={setAbandonReason}
            abandonMode={abandonMode}
            onAbandonMode={setAbandonMode}
          />
          {abandonMode ? (
            <NextButton onClick={() => setAbandoned(true)} label="Abandon the match" />
          ) : (
            <NextButton onClick={next} label={nextLabel} />
          )}
        </>
      )}

      {step === "costs" && (
        <>
          <h2 className="text-base font-semibold text-text-primary">
            What did the match cost?
          </h2>
          <StepCosts costs={costs} onChange={setCosts} locked />
          <p className="-mt-2 text-xs text-text-muted">
            The sample&apos;s amounts are fixed so everyone sees the same
            split. In your own ledger you type them in.
          </p>
          <NextButton onClick={next} label={nextLabel} />
        </>
      )}

      {step === "players" && (
        <>
          <h2 className="text-base font-semibold text-text-primary">
            Who played?
          </h2>
          <StepPlayers
            players={DEMO_PLAYERS}
            selected={selected}
            onToggle={(id) =>
              setSelected((prev) => {
                const nextSelected = new Set(prev);
                if (nextSelected.has(id)) {
                  nextSelected.delete(id);
                  // A player who did not play cannot have brought a car
                  // or ridden in one.
                  setCars((prevCars) => {
                    if (!prevCars.has(id)) return prevCars;
                    const nextCars = new Set(prevCars);
                    nextCars.delete(id);
                    return nextCars;
                  });
                  setShared((prevShared) => {
                    if (!prevShared.has(id)) return prevShared;
                    const nextShared = new Set(prevShared);
                    nextShared.delete(id);
                    return nextShared;
                  });
                } else {
                  nextSelected.add(id);
                }
                return nextSelected;
              })
            }
          />
          <NextButton onClick={next} label={nextLabel} />
        </>
      )}

      {step === "guests" && (
        <>
          <h2 className="text-base font-semibold text-text-primary">Guests</h2>
          <StepGuests
            guests={guests}
            onAddGuest={(name) =>
              setGuests((prev) => [
                ...prev,
                { name, brought_car: false, shared_car: false },
              ])
            }
            onRemoveGuest={(i) =>
              setGuests((prev) => prev.filter((_, at) => at !== i))
            }
            onToggleCar={(i) =>
              setGuests((prev) =>
                prev.map((g, at) =>
                  at === i ? { ...g, brought_car: !g.brought_car } : g,
                ),
              )
            }
          />
          {CAPTAIN && (
            <p className="-mt-2 text-xs text-text-muted">
              In this sample {CAPTAIN.name} is the captain, so guest fees
              land on {CAPTAIN.name}&apos;s balance.
            </p>
          )}
          <NextButton onClick={next} label={nextLabel} />
        </>
      )}

      {step === "carFee" && (
        <>
          <h2 className="text-base font-semibold text-text-primary">
            Car fee
          </h2>
          <StepCarAllowance
            groundLabel={DEMO_TEAM.venue}
            known
            allowance={costs.allowance}
            onAllowanceChange={(value) =>
              setCosts((prev) => ({ ...prev, allowance: value }))
            }
            ignored={ignoreAllowance}
            onIgnoredChange={setIgnoreAllowance}
            locked
          />
          <NextButton onClick={next} label={nextLabel} />
        </>
      )}

      {step === "cars" && (
        <>
          <h2 className="text-base font-semibold text-text-primary">
            Who brought a car?
          </h2>
          <p className="-mt-2 text-xs text-text-muted">
            {allowance > 0
              ? `Drivers get ${formatRupees(allowance)} back per car — funded by whoever rides with them, on the next step.`
              : "The car fee is ignored for this match — driving earns no rebate."}
          </p>
          <StepCars
            players={selectedPlayers}
            cars={cars}
            onToggleCar={toggleCar}
            allowance={allowance}
          />
          <NextButton onClick={next} label={nextLabel} />
        </>
      )}

      {step === "shared" && (
        <>
          <h2 className="text-base font-semibold text-text-primary">
            Who shared the car?
          </h2>
          <StepSharedCar
            players={selectedPlayers}
            cars={effectiveCars}
            shared={shared}
            onToggleShared={(id) =>
              setShared((prev) => {
                const nextShared = new Set(prev);
                if (nextShared.has(id)) nextShared.delete(id);
                else nextShared.add(id);
                return nextShared;
              })
            }
            onSetAllShared={(on) => {
              setShared(
                on
                  ? new Set(
                      selectedPlayers
                        .filter((p) => !effectiveCars.has(p.id))
                        .map((p) => p.id),
                    )
                  : new Set(),
              );
              setGuests((prev) =>
                prev.map((g) =>
                  g.brought_car ? g : { ...g, shared_car: on },
                ),
              );
            }}
            guests={guests}
            onToggleGuestShared={(i) =>
              setGuests((prev) =>
                prev.map((g, at) =>
                  at === i ? { ...g, shared_car: !g.shared_car } : g,
                ),
              )
            }
            allowance={allowance}
            carCount={
              selectedPlayers.filter((p) => effectiveCars.has(p.id)).length +
              guests.filter((g) => g.brought_car).length
            }
          />
          <NextButton onClick={next} label={nextLabel} />
        </>
      )}

      {step === "preview" &&
        (fees ? (
          <>
            <h2 className="text-base font-semibold text-text-primary">
              What everyone pays
            </h2>
            <StepFeePreview
              rows={displayRows.map((r) => ({
                player_id: r.playerId,
                brought_car: r.broughtCar,
                shared_car: r.sharedCar,
                fee: r.fee,
              }))}
              players={DEMO_PLAYERS}
              perPlayerFee={fees.perPlayerFee}
              carSharePerSharer={fees.carSharePerSharer}
              sharerCount={fees.sharerCount}
              totalCost={fees.totalCost}
              cashCosts={
                (Number(costs.ground) || 0) +
                (Number(costs.ball) || 0) +
                (Number(costs.other) || 0)
              }
              guestRows={fees.guestRows.map((g) => ({
                name: g.name,
                brought_car: g.broughtCar,
                shared_car: g.sharedCar,
                fee: g.fee,
              }))}
              captainCharge={fees.captainCharge}
              captainName={CAPTAIN?.name ?? null}
            />
            <button
              type="button"
              onClick={next}
              className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground"
            >
              See the match sheet
            </button>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-text-primary">
              What everyone pays
            </h2>
            <p className="rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-secondary">
              Nobody is marked as having played, so there is nothing to
              split. Go back and pick at least one player.
            </p>
          </>
        ))}
    </>
  );
}

function NextButton({
  onClick,
  label = "Next",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground"
    >
      {label}
    </button>
  );
}
