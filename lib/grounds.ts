// Known grounds and their fixed per-car allowance ("car fee"), whole
// rupees. Hardcoded like GROUND_SLOTS — adding a ground or changing a
// fee is a code edit. Completed matches snapshot the confirmed value in
// matches.car_allowance_per_car, so edits here only move prefills.
// Not to be confused with engine/carFee.ts (distance-based calculator).

export type Ground = { name: string; allowance: number };

export const GROUNDS: Ground[] = [
  { name: "Barne, Pusane", allowance: 250 },
  { name: "Vedhant, Parandwadi", allowance: 283 },
  { name: "Spark A1/A2", allowance: 87 },
  { name: "Cric Haven", allowance: 102 },
  { name: "DY Patil, Salumbre", allowance: 150 },
  { name: "Chrysallis", allowance: 133 },
  { name: "Gripx, Ravet", allowance: 156 },
  { name: "VDR, Ganhunje", allowance: 270 },
  { name: "Sachin Ghotkule/ Gurukul, Adale", allowance: 273 },
  { name: "CSMCC", allowance: 127 },
  { name: "30YCA, Chandkhed", allowance: 148 },
  { name: "Changbhale", allowance: 226 },
  { name: "Triple Crown", allowance: 77 },
  { name: "MCG", allowance: 50 },
  { name: "Lords, Mawal", allowance: 156 },
  { name: "Lords, Mulshi", allowance: 66 },
];

export const BARNE_GROUND_NAME = "Barne, Pusane";

// Case-insensitive, trimmed lookup — matches.venue may be legacy free text.
export function findGround(venue: string | null | undefined): Ground | null {
  const needle = venue?.trim().toLowerCase();
  if (!needle) return null;
  return GROUNDS.find((g) => g.name.toLowerCase() === needle) ?? null;
}

export type GroundInfo = {
  label: string;
  allowance: number | null;
  known: boolean;
};

// Provenance + venue → completion-wizard prefill. Barne matches always
// mean the home ground; away matches resolve through the venue name.
export function resolveGroundInfo(
  ground: "barne" | "other",
  venue: string | null,
): GroundInfo {
  if (ground === "barne") {
    const barne = findGround(BARNE_GROUND_NAME)!;
    return { label: barne.name, allowance: barne.allowance, known: true };
  }
  const hit = findGround(venue);
  if (hit) return { label: hit.name, allowance: hit.allowance, known: true };
  return { label: venue?.trim() || "Away ground", allowance: null, known: false };
}
