// Display formatting helpers. Money rendering goes through <Money> —
// these are the primitives it (and date displays) build on.

export function formatRupees(amount: number): string {
  return Math.abs(Math.round(amount)).toLocaleString("en-IN");
}

// Pinned to IST — server rendering happens in UTC (Vercel), which would
// otherwise show the previous day for anything after 18:30 IST.
const TZ = "Asia/Kolkata";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}

export function formatWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "long",
    timeZone: TZ,
  });
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: TZ,
  });
}

// Today's date (yyyy-mm-dd) in IST regardless of the server timezone.
export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

// "17:30" or Postgres "17:30:00" -> "5:30 pm" (tournament match slots).
export function formatTime(time: string): string {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// A match may be scheduled before an opponent is known (migration 36),
// so every "vs …" render goes through here rather than interpolating a
// null into the page. The card's red dot signals the same state.
export function opponentLabel(opponent: string | null | undefined): string {
  return opponent?.trim() || "Opponent TBD";
}

// Our side of a "vs …" title — the team's display name, which the
// superadmin rename (api/sa/team) keeps current.
export function teamLabel(team: { display_name: string }): string {
  return team.display_name;
}
