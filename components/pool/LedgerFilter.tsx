"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Filter } from "lucide-react";
import { LEDGER_FILTERS, ledgerFilterDef, type LedgerFilter } from "@/lib/poolKinds";
import { cn } from "@/lib/utils";

type Props = { value: LedgerFilter };

// A funnel icon button (the share button's old cell on the admin toolbar,
// right-aligned above the viewer's list) that opens a menu of ledger
// kinds. An amber dot on the icon says a filter is on; "All entries"
// shows no dot. The choice travels in the URL (`/pool?kind=…`) and the
// server does the filtering — the ledger is paged, so a client-side
// filter over the fetched page would miss older rows. Picking a kind
// always lands on page 1.
//
// Hand-rolled menu, the AccountMenu recipe, not Radix: Escape, outside
// tap and item-select close it; menuitemradio keeps it a proper picker
// for assistive tech. Replaced the 2026-10-23 full-width <select> on the
// owner's phone screenshot (2026-10-24).
export function LedgerFilter({ value }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const active = value !== "all";
  const label = ledgerFilterDef(value).label;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: LedgerFilter) {
    setOpen(false);
    if (next !== value) router.push(next === "all" ? "/pool" : `/pool?kind=${next}`);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={active ? `Filter ledger — showing ${label}` : "Filter ledger"}
        title={active ? `Filter: ${label}` : "Filter ledger"}
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface shadow-card text-text-secondary"
      >
        <Filter size={18} aria-hidden />
        {active && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-low ring-2 ring-surface"
          />
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Filter ledger"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border border-border bg-surface p-1 shadow-md"
        >
          {LEDGER_FILTERS.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => pick(o.value)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-surface-secondary focus-visible:bg-surface-secondary",
                  selected ? "font-medium text-text-primary" : "text-text-primary",
                )}
              >
                <span className="truncate">{o.label}</span>
                {selected && <Check size={14} aria-hidden className="shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
