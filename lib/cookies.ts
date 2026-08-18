// Shared with proxy.ts (middleware runtime), which must not import
// lib/session.ts — that would pull pg + next/headers into the edge
// bundle. Keep this module dependency-free.
export const SESSION_COOKIE = "cl_session";
