"use client";

import { GROUNDS, findGround } from "@/lib/grounds";

// Sentinel select value for a ground not in the list.
export const OTHER_GROUND = "__other__";

type Props = {
  choice: string; // "" | canonical ground name | OTHER_GROUND
  customName: string; // free text, used when choice === OTHER_GROUND
  onChoiceChange: (value: string) => void;
  onCustomNameChange: (value: string) => void;
  disabled?: boolean;
};

// Map a stored venue back to dropdown state (legacy venues may be free
// text — a name not in the list lands on "Other ground…" preserved).
export function venueToSelection(venue: string | null | undefined): {
  choice: string;
  customName: string;
} {
  const trimmed = venue?.trim() ?? "";
  if (!trimmed) return { choice: "", customName: "" };
  const hit = findGround(trimmed);
  if (hit) return { choice: hit.name, customName: "" };
  return { choice: OTHER_GROUND, customName: trimmed };
}

const inputClass =
  "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function GroundSelect({
  choice,
  customName,
  onChoiceChange,
  onCustomNameChange,
  disabled = false,
}: Props) {
  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">Ground</span>
        <select
          value={choice}
          onChange={(e) => onChoiceChange(e.target.value)}
          required
          disabled={disabled}
          className={inputClass}
        >
          <option value="">Choose a ground…</option>
          {GROUNDS.map((g) => (
            <option key={g.name} value={g.name}>
              {g.name}
            </option>
          ))}
          <option value={OTHER_GROUND}>Other ground…</option>
        </select>
      </label>
      {choice === OTHER_GROUND && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            Ground name
          </span>
          <input
            type="text"
            value={customName}
            onChange={(e) => onCustomNameChange(e.target.value)}
            placeholder="Poynad ground"
            maxLength={80}
            required
            disabled={disabled}
            className={inputClass}
          />
        </label>
      )}
    </>
  );
}
