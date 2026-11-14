"use client";

import { useId } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

// Numeric rupee input: ₹ prefix inside the field, numeric keypad,
// whole rupees only. Value stays a string in state; parse at submit.
//
// The title is a <label htmlFor> and the ₹ prefix sits OUTSIDE it
// (aria-hidden too), so the field's accessible name is exactly `label`.
// It used to be one wrapping <label>, which made the name "Ground fee ₹"
// (test_docs F-5, 2026-11-14). Same classes, same layout.
export function MoneyInput({
  label,
  value,
  onChange,
  placeholder = "0",
  required = false,
  disabled = false,
}: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-text-secondary">
        {label}
      </label>
      <span className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-text-muted"
        >
          ₹
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className="h-11 w-full rounded-md border border-border bg-surface-secondary pl-8 pr-3 text-base tabular-nums text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
        />
      </span>
    </div>
  );
}
