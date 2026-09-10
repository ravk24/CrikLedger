"use client";

import { useState } from "react";
import { activeGrounds, findGround, type TeamGround } from "@/lib/grounds";
import { formatRupees } from "@/lib/format";

type Props = {
  grounds: TeamGround[]; // the team's presets; [] renders the plain input
  value: string; // the venue string the form submits
  onChange: (value: string) => void;
  required?: boolean;
  inputClass: string;
};

const OTHER = "__other__";

// The ground field on both scheduling forms. With presets it is a
// dropdown of the active grounds plus "Other ground…", which reveals
// the free-text input the field used to be — so the venue stays a
// plain string on the match and a team with no presets sees no change.
// The car allowance shown beside each name is what the completion
// wizard will prefill for that ground.
export function GroundPicker({
  grounds,
  value,
  onChange,
  required = false,
  inputClass,
}: Props) {
  const options = activeGrounds(grounds);
  const matched = findGround(options, value);
  // "Other" stays open once chosen even while the text is still empty;
  // it also opens by itself when the value is a name with no preset
  // (editing an older match).
  const [otherChosen, setOtherChosen] = useState(false);
  const showOther = otherChosen || (value.trim() !== "" && !matched);

  if (options.length === 0) {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">Ground</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ground name"
          required={required}
          className={inputClass}
        />
      </label>
    );
  }

  const selectValue = showOther ? OTHER : (matched?.name ?? "");

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">Ground</span>
        <select
          value={selectValue}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setOtherChosen(true);
              onChange("");
            } else {
              setOtherChosen(false);
              onChange(e.target.value);
            }
          }}
          required={required && !showOther}
          className={inputClass}
        >
          <option value="" disabled>
            Choose a ground
          </option>
          {options.map((g) => (
            <option key={g.id} value={g.name}>
              {g.name}
              {g.car_allowance > 0
                ? ` · ₹${formatRupees(g.car_allowance)} / car`
                : ""}
            </option>
          ))}
          <option value={OTHER}>Other ground…</option>
        </select>
      </label>
      {showOther && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            Ground name
          </span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type the ground name"
            required={required}
            autoFocus
            className={inputClass}
          />
          <span className="text-xs text-text-muted">
            Not in the team&apos;s list — the car fee will be typed when the
            match is completed.
          </span>
        </label>
      )}
    </div>
  );
}
