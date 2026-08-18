"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, MapPin } from "lucide-react";
import { StepCars } from "@/components/wizard/StepCars";
import { StepCosts } from "@/components/wizard/StepCosts";
import { StepFeePreview } from "@/components/wizard/StepFeePreview";
import { GuestMatchSheet } from "@/components/guest/GuestMatchSheet";
import { calculateMatchFees } from "@/engine/calc";
import { formatRupees } from "@/lib/format";
import {
  DEMO_COSTS,
  DEMO_DRIVERS,
  DEMO_PLAYERS,
  DEMO_TEAM,
} from "@/lib/demo/fixtures";
import type { WizardCosts } from "@/components/wizard/wizardTypes";

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
// that must never regress.
type Step = "intro" | "costs" | "cars" | "preview" | "sheet";

const STEP_ORDER: Step[] = ["intro", "costs", "cars", "preview", "sheet"];

export function GuestMatchFlow() {
  const [step, setStep] = useState<Step>("intro");
  const [costs, setCosts] = useState<WizardCosts>({ ...DEMO_COSTS });
  const [cars, setCars] = useState<Set<string>>(new Set(DEMO_DRIVERS));

  const allowance = Number(costs.allowance) || 0;

  const result = useMemo(() => {
    try {
      return calculateMatchFees({
        groundFee: Number(costs.ground) || 0,
        ballFee: Number(costs.ball) || 0,
        otherFee: Number(costs.other) || 0,
        carAllowancePerCar: allowance,
        attendees: DEMO_PLAYERS.map((p) => ({
          playerId: p.id,
          broughtCar: cars.has(p.id),
        })),
        // No guests in the sample: the guest-charge rule needs a standing
        // captain to absorb the charge, and a sample team has none.
        guests: [],
      });
    } catch {
      return null;
    }
  }, [costs, cars, allowance]);

  const index = STEP_ORDER.indexOf(step);
  const back = () => setStep(STEP_ORDER[Math.max(0, index - 1)]);
  const next = () =>
    setStep(STEP_ORDER[Math.min(STEP_ORDER.length - 1, index + 1)]);

  if (step === "sheet" && result) {
    return (
      <GuestMatchSheet
        result={result}
        costs={costs}
        cars={cars}
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
          Sample · step {index + 1} of {STEP_ORDER.length - 1}
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
              {DEMO_PLAYERS.length} players played. Complete the match to see
              how CrikLedger splits the cost — and share the result.
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

      {step === "costs" && (
        <>
          <h2 className="text-base font-semibold text-text-primary">
            What did the day cost?
          </h2>
          <StepCosts costs={costs} onChange={setCosts} />
          <NextButton onClick={next} />
        </>
      )}

      {step === "cars" && (
        <>
          <h2 className="text-base font-semibold text-text-primary">
            Who brought a car?
          </h2>
          <p className="-mt-2 text-xs text-text-muted">
            Drivers get {formatRupees(allowance)} back per car, shared across
            everyone else.
          </p>
          <StepCars
            players={DEMO_PLAYERS}
            cars={cars}
            onToggleCar={(id) =>
              setCars((prev) => {
                const nextCars = new Set(prev);
                if (nextCars.has(id)) nextCars.delete(id);
                else nextCars.add(id);
                return nextCars;
              })
            }
            allowance={allowance}
          />
          <NextButton onClick={next} />
        </>
      )}

      {step === "preview" && result && (
        <>
          <h2 className="text-base font-semibold text-text-primary">
            What everyone pays
          </h2>
          <StepFeePreview
            rows={result.rows.map((r) => ({
              player_id: r.playerId,
              brought_car: r.broughtCar,
              fee: r.fee,
            }))}
            players={DEMO_PLAYERS}
            editedKeys={new Set()}
            onEditFee={() => {}}
            onResetEdits={() => {}}
            perPlayerFee={result.perPlayerFee}
            totalCost={result.totalCost}
            cashCosts={
              (Number(costs.ground) || 0) +
              (Number(costs.ball) || 0) +
              (Number(costs.other) || 0)
            }
            guestRows={[]}
            captainCharge={0}
            captainName={null}
          />
          <button
            type="button"
            onClick={next}
            className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground"
          >
            See the match sheet
          </button>
        </>
      )}
    </>
  );
}

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground"
    >
      Next
    </button>
  );
}
