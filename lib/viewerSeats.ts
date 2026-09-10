// The team viewer's seats (migration 52). Zero imports: this is read by
// the login route, the session loader, the superadmin's card (a client
// component) and vitest alike.

/** How many players may hold the shared viewer login at once, per team. */
export const VIEWER_SEAT_LIMIT = 10;

export type ViewerSeat = {
  id: string;
  started_at: string;
  device: string | null; // coarse label from the User-Agent, never the raw string
};

export type ViewerRow = {
  username: string;
  created_at: string;
  seats: ViewerSeat[];
};

// Shown verbatim by LoginForm for VIEWER_BUSY. Names the superadmin so a
// refused player knows who can free a seat.
export function viewerBusyMessage(
  limit: number,
  superadmin: string | null,
): string {
  const who = superadmin ?? "your superadmin";
  return (
    `All ${limit} viewer seats are in use. ` +
    `Ask ${who} (superadmin) to sign one out from Manage admins, ` +
    `or ask someone in your WhatsApp group who is signed in to log out.`
  );
}

export function seatsInUseLabel(n: number, limit: number): string {
  if (n <= 0) return "No one is signed in right now";
  return `${n} of ${limit} seat${limit === 1 ? "" : "s"} in use`;
}

// Coarse device family for the superadmin's seat list. Deliberately
// blunt — modern browsers reduce their User-Agent, so this is what can
// be told apart. The time column is what distinguishes two iPhones.
// Always ≤ 40 characters (viewer_sessions.device CHECK).
export function deviceLabel(
  userAgent: string | null | undefined,
): string | null {
  if (!userAgent) return null;
  const ua = userAgent;
  if (/iPad/i.test(ua)) return "iPad";
  if (/iPhone|iPod/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) {
    return /Mobile/i.test(ua) ? "Android phone" : "Android tablet";
  }
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/CrOS/i.test(ua)) return "Chromebook";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A seat id is a UUID; anything else must never reach a ::uuid cast. */
export function isSeatId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// The per-request rule, in one testable place:
//   * a token carrying a seat id is good only while that row exists —
//     deleting the row is how one phone is signed out;
//   * a token without one is good only for a non-viewer account, so a
//     seat-less viewer token can never slip past the cap.
export function seatCheckPasses(args: {
  isViewer: boolean;
  sid: string | undefined;
  seatAlive: boolean;
}): boolean {
  if (args.sid !== undefined) return args.seatAlive;
  return !args.isViewer;
}
