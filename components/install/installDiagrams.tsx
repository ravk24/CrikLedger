import type { ReactNode } from "react";
import { PhoneDiagram } from "./PhoneDiagram";
import { INSTALL_STEPS, type InstallStepId } from "./steps";

// Server-side: every step's diagram rendered once, handed to the client
// guide as plain React nodes. The 500-line SVG file then never enters
// the client bundle — the guide only decides which node to show.
export function renderInstallDiagrams(): Record<InstallStepId, ReactNode> {
  const out = {} as Record<InstallStepId, ReactNode>;
  for (const steps of Object.values(INSTALL_STEPS)) {
    for (const step of steps) {
      out[step.id] = <PhoneDiagram step={step.id} alt={step.alt} />;
    }
  }
  return out;
}
