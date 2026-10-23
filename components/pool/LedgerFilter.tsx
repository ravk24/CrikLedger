"use client";

import { useRouter } from "next/navigation";
import { LEDGER_FILTERS, type LedgerFilter } from "@/lib/poolKinds";

type Props = { value: LedgerFilter };

// One dropdown above the ledger, for admins and viewers alike. The
// choice travels in the URL (`/pool?kind=…`) and the server does the
// filtering — the ledger is paged, so a client-side filter over the
// fetched page would miss older rows. Picking a kind always lands on
// page 1. Same select recipe as ScheduledMatchList, at the toolbar's
// 44px height.
export function LedgerFilter({ value }: Props) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Filter ledger</span>
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          router.push(next === "all" ? "/pool" : `/pool?kind=${next}`);
        }}
        className="h-11 w-full rounded-md border border-border bg-surface shadow-card px-3 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {LEDGER_FILTERS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
