// Shared with proxy.ts (middleware runtime), which must not import
// lib/session.ts — that would pull pg + next/headers into the edge
// bundle. Keep this module dependency-free.
export const SESSION_COOKIE = "cl_session";

// Active-team hint: holds a team SLUG, never an id, and is re-validated
// against live memberships on every request (lib/roles.ts
// resolveActiveTeamId). A stale or forged value loses rather than
// granting anything, so proxy.ts passes it through untouched.
export const TEAM_COOKIE = "cl_team";

// Session lifetime, shared by the cookie maxAge, the JWT exp, and the
// viewer-seat reap window (lib/viewer.ts, app/api/auth/login): a seat
// row older than this belongs to a token that can no longer verify.
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
