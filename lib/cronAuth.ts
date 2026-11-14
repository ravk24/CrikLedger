// The CRON_SECRET bearer check shared by /api/cron/keepalive and
// /api/health. Dependency-free on purpose: the health route must load
// even when DATABASE_URL or SESSION_SECRET is missing.
//
// Fails CLOSED. The old inline check compared the header against
// `Bearer ${process.env.CRON_SECRET}`, which with the variable unset is
// the literal string "Bearer undefined" — so that exact header was let
// in (test_docs F-2, 2026-11-14). An unset or blank secret now refuses
// everyone. Vercel's cron sends no Authorization header at all when the
// variable is unset, so the daily keepalive behaves exactly as before.
export function isCronAuthorized(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !secret.trim()) return false;
  return authorization === `Bearer ${secret}`;
}
