// A team's ground presets (migration 51): a name and the per-car
// allowance the completion wizard prefills. Pure helpers only — the
// cached read lives in lib/team.ts, the writes in app/api/sa/grounds.

export type TeamGround = {
  id: string;
  name: string;
  car_allowance: number; // whole rupees
  is_active: boolean;
};

// Matching a match's free-text venue to a preset is by name, trimmed
// and case-insensitive, the way the dropped feature did it. There is
// no FK: renaming a ground never rewrites a match, and a venue typed
// under "Other ground…" simply matches nothing.
export function groundKey(name: string): string {
  return name.trim().toLowerCase();
}

export function findGround(
  grounds: readonly TeamGround[],
  venue: string | null | undefined,
): TeamGround | null {
  if (!venue) return null;
  const key = groundKey(venue);
  if (!key) return null;
  return grounds.find((g) => g.is_active && groundKey(g.name) === key) ?? null;
}

export function activeGrounds(grounds: readonly TeamGround[]): TeamGround[] {
  return grounds.filter((g) => g.is_active);
}
