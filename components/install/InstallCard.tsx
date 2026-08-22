"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { InstallGuide } from "./InstallGuide";
import type { InstallStepId } from "./steps";

// Home's "How to install" row. Collapsed by default so Home reads as the
// three-choice landing screen; tapping it unfolds the InstallGuide in
// place rather than leaving the page. Same disclosure shape as
// components/admin/PrivilegesCard.tsx (aria-expanded + rotating chevron).
export function InstallCard({
  diagrams,
}: {
  // Pre-rendered on the server (components/install/installDiagrams.tsx).
  diagrams: Record<InstallStepId, ReactNode>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="install-guide"
        className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-border bg-surface p-4 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent">
          <Smartphone size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text-primary">
            How to install
          </span>
          <span className="block text-xs text-text-muted">
            Put CrikLedger on your home screen — no app store needed
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
        <div id="install-guide">
          <InstallGuide diagrams={diagrams} />
        </div>
      )}
    </>
  );
}
