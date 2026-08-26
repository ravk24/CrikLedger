import type { ReactNode } from "react";
import { PhoneDiagram } from "./PhoneDiagram";
import { INSTALL_STEPS, type InstallStepId } from "./steps";

// Server-side: step diagrams rendered once, handed to the client guide
// as plain React nodes. The 500-line SVG file then never enters the
// client bundle — the guide only decides which node to show.
//
// `only` limits which steps get a picture. /install renders all eight;
// the signed-out Home page — the first-impression screen, on mobile
// data — streams just the first step of each platform inside a
// collapsed card (~20 KB of SVG otherwise rode along in the RSC payload
// for an accordion most visitors never open) and links to /install for
// the full illustrated walkthrough.
export type InstallDiagrams = Partial<Record<InstallStepId, ReactNode>>;

export function renderInstallDiagrams(
  only?: readonly InstallStepId[],
): InstallDiagrams {
  const out: InstallDiagrams = {};
  for (const steps of Object.values(INSTALL_STEPS)) {
    for (const step of steps) {
      if (only && !only.includes(step.id)) continue;
      out[step.id] = <PhoneDiagram step={step.id} alt={step.alt} />;
    }
  }
  return out;
}

/** The first step of each platform — what Home shows. */
export const HOME_DIAGRAM_STEPS: readonly InstallStepId[] = [
  "android-open",
  "ios-open",
];
