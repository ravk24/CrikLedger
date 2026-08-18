// Pure helpers over a team's ground list. The list itself lives in the
// DB (team_grounds, read via getTeamGrounds() in lib/team.ts) — server
// pages fetch it and thread it to these helpers and to client
// components as props. Completed matches snapshot the confirmed value
// in matches.car_allowance_per_car, so ground edits only move prefills.
// Not to be confused with engine/carFee.ts (distance-based calculator).

export type Ground = { name: string; allowance: number };

// Case-insensitive, trimmed lookup — matches.venue may be legacy free text.
export function findGround(
  grounds: Ground[],
  venue: string | null | undefined,
): Ground | null {
  const needle = venue?.trim().toLowerCase();
  if (!needle) return null;
  return grounds.find((g) => g.name.toLowerCase() === needle) ?? null;
}

export type GroundInfo = {
  label: string;
  allowance: number | null;
  known: boolean;
};

// Provenance + venue → completion-wizard prefill. Home matches always
// mean the team's home ground; away matches resolve through the venue
// name. homeGroundName comes from teams.home_ground_name.
export function resolveGroundInfo(
  ground: "barne" | "other",
  venue: string | null,
  grounds: Ground[],
  homeGroundName: string | null,
): GroundInfo {
  if (ground === "barne") {
    const home = findGround(grounds, homeGroundName);
    if (home) return { label: home.name, allowance: home.allowance, known: true };
    return { label: homeGroundName ?? "Home ground", allowance: null, known: false };
  }
  const hit = findGround(grounds, venue);
  if (hit) return { label: hit.name, allowance: hit.allowance, known: true };
  return { label: venue?.trim() || "Away ground", allowance: null, known: false };
}
