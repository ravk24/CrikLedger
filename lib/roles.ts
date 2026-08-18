// Pure authorization logic — the single place that decides who may do
// what. No pg, no next/headers, no imports at all, so it is unit-testable
// without a database (lib/roles.test.ts) and safe to reason about in
// isolation. lib/session.ts loads the rows; this module interprets them.
//
// The model, since migration 32:
//   - An ACCOUNT (admins row) has a platform_role and no powers of its own.
//   - Power comes from MEMBERSHIP rows, one per (account, scope), where a
//     scope is a team or a tournament. Each scope grants 'superadmin'
//     (the purchaser) or 'admin' (<= 2 per scope).
//   - A person may hold different roles in different scopes: superadmin of
//     their own team, admin on someone else's.
//   - megaadmin is PLATFORM level: it reads every scope so user-reported
//     bugs can be reproduced, and writes NONE of them. It must never hold
//     a membership row — team rights belong on a separate account.

export type PlatformRole = "user" | "megaadmin";
export type ScopeKind = "team" | "tournament";
export type ScopeRole = "superadmin" | "admin";

export type Membership = {
  kind: ScopeKind;
  id: string;
  slug: string; // teams.slug; tournaments use their id (no slug column)
  name: string;
  role: ScopeRole;
};

export type Principal = {
  id: string;
  platformRole: PlatformRole;
  memberships: Membership[]; // ACTIVE rows only — revoked ones never load
};

export function isMegaadmin(p: Principal | null): boolean {
  return p?.platformRole === "megaadmin";
}

/**
 * The role an account explicitly holds in a scope, from membership rows
 * only. Deliberately blind to megaadmin: this answers "what did they
 * buy or get granted", not "what may they do". Use canRead/canWrite for
 * the latter.
 */
export function scopeRoleFor(
  p: Principal | null,
  kind: ScopeKind,
  scopeId: string | null,
): ScopeRole | null {
  if (!p || !scopeId) return null;
  const m = p.memberships.find((x) => x.kind === kind && x.id === scopeId);
  return m ? m.role : null;
}

export function isScopeMember(
  p: Principal | null,
  kind: ScopeKind,
  scopeId: string | null,
): boolean {
  return scopeRoleFor(p, kind, scopeId) !== null;
}

export function isScopeSuperadmin(
  p: Principal | null,
  kind: ScopeKind,
  scopeId: string | null,
): boolean {
  return scopeRoleFor(p, kind, scopeId) === "superadmin";
}

/**
 * Read access. The megaadmin sees everything — that is the whole point of
 * the role: reproduce what a user reports without asking for their
 * password.
 */
export function canRead(
  p: Principal | null,
  kind: ScopeKind,
  scopeId: string | null,
): boolean {
  if (!scopeId) return false;
  if (isMegaadmin(p)) return true;
  return isScopeMember(p, kind, scopeId);
}

/**
 * Write access. The megaadmin is explicitly REFUSED, even though it can
 * read the same scope — an observer, not an operator. This is what keeps
 * a bug in the /ops console from corrupting a customer's ledger, and what
 * keeps the platform account off other people's "edited by" stamps.
 *
 * Account-level actions the megaadmin legitimately performs (password
 * reset, suspend) are not scope writes and do not come through here.
 */
export function canWrite(
  p: Principal | null,
  kind: ScopeKind,
  scopeId: string | null,
): boolean {
  if (!scopeId || !p) return false;
  if (isMegaadmin(p)) return false;
  return isScopeMember(p, kind, scopeId);
}

/** Scope writes reserved for the purchaser (destructive actions, managing admins). */
export function canAdminister(
  p: Principal | null,
  kind: ScopeKind,
  scopeId: string | null,
): boolean {
  if (!canWrite(p, kind, scopeId)) return false;
  return isScopeSuperadmin(p, kind, scopeId);
}

export function teamMemberships(p: Principal | null): Membership[] {
  return (p?.memberships ?? []).filter((m) => m.kind === "team");
}

export function tournamentMemberships(p: Principal | null): Membership[] {
  return (p?.memberships ?? []).filter((m) => m.kind === "tournament");
}

/**
 * Resolve the active team for a request from the `cl_team` cookie.
 *
 * The cookie is a HINT, never an authority: it is re-validated against
 * live memberships on every request, so a revoked or forged slug simply
 * loses. It is never "repaired" here — a Server Component cannot write
 * cookies, and a stale value is harmless once ignored; login and the
 * switch route are the only writers.
 *
 * `knownTeams` (slug -> id) is consulted only for a megaadmin, who may
 * observe a team without holding a membership in it.
 */
export function resolveActiveTeamId(
  p: Principal | null,
  cookieSlug: string | null,
  knownTeams?: ReadonlyMap<string, string>,
): string | null {
  if (!p) return null;
  const teams = teamMemberships(p);

  if (cookieSlug) {
    const match = teams.find((m) => m.slug === cookieSlug);
    if (match) return match.id;
    if (isMegaadmin(p)) {
      const known = knownTeams?.get(cookieSlug);
      if (known) return known;
    }
  }

  // Deterministic fallback: first membership by name, so a user with no
  // cookie always lands somewhere stable rather than somewhere random.
  return teams.length > 0 ? teams[0].id : null;
}

/**
 * Session epoch check. The JWT carries the epoch it was minted with;
 * logout and password change bump the row, which invalidates every
 * outstanding token without a sessions table. Anything that is not an
 * exact numeric match fails, which also rejects pre-migration-32 tokens
 * that carry no epoch claim at all.
 */
export function isEpochValid(tokenEpoch: unknown, rowEpoch: number): boolean {
  if (typeof tokenEpoch !== "number" || !Number.isInteger(tokenEpoch)) {
    return false;
  }
  return tokenEpoch === rowEpoch;
}

/**
 * Invariant check surfaced in the /ops console: a megaadmin holding a
 * membership row is a bug in the membership routes. Enforced in the app
 * rather than the database because a CHECK cannot span tables and this
 * repo deliberately has no triggers.
 */
export function violatesMegaadminIsolation(p: Principal | null): boolean {
  return isMegaadmin(p) && (p?.memberships.length ?? 0) > 0;
}
