// Pure authorization logic — the single place that decides who may do
// what. No pg, no next/headers, no imports at all, so it is unit-testable
// without a database (lib/roles.test.ts) and safe to reason about in
// isolation. lib/session.ts loads the rows; this module interprets them.
//
// The model, since migration 32:
//   - An ACCOUNT (admins row) has a platform_role and no powers of its own.
//   - Power comes from MEMBERSHIP rows, one per (account, scope), where a
//     scope is a team or a tournament. Each scope grants 'superadmin'
//     (the purchaser), 'admin' (<= 2 per scope), or — teams only, since
//     migration 49 — 'viewer': one shared read-only login the whole team
//     uses. A viewer reads what a member reads and writes nothing.
//   - A person may hold different roles in different scopes: superadmin of
//     their own team, admin on someone else's.
//   - megaadmin is PLATFORM level: it reads every scope so user-reported
//     bugs can be reproduced, and writes NONE of them. It must never hold
//     a membership row — team rights belong on a separate account.

export type PlatformRole = "user" | "megaadmin";
export type ScopeKind = "team" | "tournament";
export type ScopeRole = "superadmin" | "admin" | "viewer";

export type Membership = {
  kind: ScopeKind;
  id: string;
  slug: string; // teams.slug; tournaments use their id (no slug column)
  name: string;
  role: ScopeRole;
};

// One (team, product) summary from the entitlements table (migration
// 37). `unused` only means something for tournament credits.
export type EntitlementSummary = {
  teamId: string;
  product: "team_ledger" | "tournament_credit";
  total: number;
  unused: number;
};

export type Principal = {
  id: string;
  platformRole: PlatformRole;
  memberships: Membership[]; // ACTIVE rows only — revoked ones never load
  entitlements?: EntitlementSummary[]; // per member team; absent = none
};

export function isMegaadmin(p: Principal | null): boolean {
  return p?.platformRole === "megaadmin";
}

/**
 * The shared team-viewer login: an account whose every membership is a
 * 'viewer' row. The viewer routes never link an existing account and
 * /api/sa/admins refuses to link a viewer one, so in practice it holds
 * exactly one. Used for account-level decisions (no password change,
 * logout must not sign out the other phones); scope decisions still go
 * through canWrite, which is what refuses the writes.
 */
export function isViewer(p: Principal | null): boolean {
  if (!p || isMegaadmin(p)) return false;
  return (
    p.memberships.length > 0 && p.memberships.every((m) => m.role === "viewer")
  );
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
 * A 'viewer' membership is refused too: membership alone used to be
 * enough here, and the day a third role arrived that would have made
 * the shared read-only login a full admin. The role is consulted, not
 * just the row.
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
  const role = scopeRoleFor(p, kind, scopeId);
  return role !== null && role !== "viewer";
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
