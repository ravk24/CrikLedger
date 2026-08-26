// Display formatting helpers. Money rendering goes through <Money> —
// these are the primitives it (and date displays) build on.
//
// One Intl formatter per shape, built once per module load. The
// toLocaleString() / toLocaleDateString() forms construct a fresh
// Intl.NumberFormat / Intl.DateTimeFormat on EVERY call (plus an ICU
// timezone lookup for the IST pin); a 60-row ledger page did that
// 100–180 times, on the server render and again at hydration. The
// output is byte-identical — lib/format.test.ts pins it against strings
// captured from the old implementation.

// Pinned to IST — server rendering happens in UTC (Vercel), which would
// otherwise show the previous day for anything after 18:30 IST.
const TZ = "Asia/Kolkata";

const rupeesFormat = new Intl.NumberFormat("en-IN");
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: TZ,
});
const weekdayFormat = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  timeZone: TZ,
});
const dateWithWeekdayFormat = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: TZ,
});
const dateShortFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  timeZone: TZ,
});
const monthFormat = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: TZ,
});
const isoDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

export function formatRupees(amount: number): string {
  return rupeesFormat.format(Math.abs(Math.round(amount)));
}

// A per-person match fee, in the words the team reads it: "₹5" is what
// they pay; a negative fee is money the team owes them and reads
// "gets ₹53". Never a bare "+" or "−" — "+₹53" was read as "pays 53
// more", which is the opposite of what it meant.
export function formatFee(fee: number): string {
  return fee < 0 ? `gets ₹${formatRupees(-fee)}` : `₹${formatRupees(fee)}`;
}

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatWeekday(iso: string): string {
  return weekdayFormat.format(new Date(iso));
}

// "Sat, 28 Aug 2026" — the shared match sheet.
export function formatDateWithWeekday(iso: string): string {
  return dateWithWeekdayFormat.format(new Date(iso));
}

export function formatDateShort(iso: string): string {
  return dateShortFormat.format(new Date(iso));
}

// "August 2026" — month separators in the scheduled list.
export function formatMonth(iso: string): string {
  return monthFormat.format(new Date(iso));
}

// Today's date (yyyy-mm-dd) in IST regardless of the server timezone.
export function todayIST(): string {
  return isoDayFormat.format(new Date());
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
// null into the page. The upcoming-list filter exposes the same state.
export function opponentLabel(opponent: string | null | undefined): string {
  return opponent?.trim() || "Opponent TBD";
}

// Our side of a "vs …" title — the team's display name, which the
// superadmin rename (api/sa/team) keeps current.
export function teamLabel(team: { display_name: string }): string {
  return team.display_name;
}
