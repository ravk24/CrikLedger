"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

// The directory's pitch to visitors without a tournament credit: a collapsed
// curtain that unfolds the Tournament product card and the payment explainer
// in place, so a signed-out visitor sees a price without bouncing off the
// /purchases login wall. Same disclosure shape as
// components/install/InstallCard.tsx (aria-expanded + rotating chevron).
export function TournamentPricingCurtain({
  children,
}: {
  // Pre-rendered on the server (ProductCard + HowPaymentWorks).
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="tournament-pricing"
        className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-border bg-surface shadow-card p-4 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-light text-accent">
          <Trophy size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text-primary">
            Want to host your tournament here?
          </span>
          <span className="block text-xs text-text-muted">
            See pricing and how payment works
          </span>
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-text-muted transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded && (
        <div id="tournament-pricing" className="flex flex-col gap-4">
          {children}
        </div>
      )}
    </>
  );
}
