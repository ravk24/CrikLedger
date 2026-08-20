"use client";

import { MoneyInput } from "@/components/shared/MoneyInput";
import { formatRupees } from "@/lib/format";
import type { WizardCosts } from "@/components/wizard/wizardTypes";

type Props = {
  costs: WizardCosts;
  onChange: (costs: WizardCosts) => void;
  // The guest sample fixes its amounts so every visitor sees the same
  // split; the paid wizard never passes this.
  locked?: boolean;
};

export function StepCosts({ costs, onChange, locked = false }: Props) {
  const soFar =
    (Number(costs.ground) || 0) +
    (Number(costs.ball) || 0) +
    (Number(costs.other) || 0);

  return (
    <div className="flex flex-col gap-3">
      <MoneyInput
        label="Ground fee"
        value={costs.ground}
        onChange={(v) => onChange({ ...costs, ground: v })}
        disabled={locked}
      />
      <MoneyInput
        label="Ball cost"
        value={costs.ball}
        onChange={(v) => onChange({ ...costs, ball: v })}
        disabled={locked}
      />
      <MoneyInput
        label="Other (umpire, water) — 0 is fine"
        value={costs.other}
        onChange={(v) => onChange({ ...costs, other: v })}
        disabled={locked}
      />
      <p className="rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-secondary">
        Costs so far ₹{formatRupees(soFar)}
      </p>
    </div>
  );
}
