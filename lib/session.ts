import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { SESSION_COOKIE, TEAM_COOKIE } from "@/lib/cookies";
import { pool } from "@/lib/db";
import { ApiError } from "@/lib/validate";
import {
  canAdminister,
  canWrite,
  isEpochValid,
  isMegaadmin,
  resolveActiveTeamId,
  scopeRoleFor,
  type Membership,
  type Principal,
  type ScopeKind,
  type ScopeRole,
} from "@/lib/roles";

export { SESSION_COOKIE, TEAM_COOKIE };
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
const SESSION_MAX_AGE_JWT = "30d"; // keep in step with the seconds above

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

// The token carries identity and nothing else. Roles deliberately LEFT
// the payload at migration 32: they now live in membership rows that can
// be revoked mid-session, and a role baked into a 30-day cookie cannot.
type SessionPayload = {
  adminId: string;
  epoch: number;
};

export type SessionAdmin = Principal & {
  username: string;
  name: string;
  email: string | null;
  mustChangePassword: boolean;
  activeTeamId: string | null;
  activeTeamSlug: string | null;
  /** Role in the active team — what UI gating should read. */
  activeTeamRole: ScopeRole | null;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(SESSION_MAX_AGE_JWT)
    .sign(secret());
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * The active-team hint. Not httpOnly-sensitive in itself — it is only a
 * slug, and it is re-validated against live memberships on every request
 * (lib/roles.ts resolveActiveTeamId), so a tampered value cannot grant
 * anything. httpOnly anyway, since nothing client-side needs to read it.
 */
export async function setTeamCookie(slug: string): Promise<void> {
  const store = await cookies();
  store.set(TEAM_COOKIE, slug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(TEAM_COOKIE);
}

async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.adminId !== "string") return null;
    // Pre-migration-32 tokens carry `role` and no `epoch`; they fail here
    // and the holder simply signs in again.
    if (typeof payload.epoch !== "number") return null;
    return { adminId: payload.adminId, epoch: payload.epoch };
  } catch {
    return null;
  }
}

type AdminRow = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  platform_role: "user" | "megaadmin";
  must_change_password: boolean;
  is_active: boolean;
  session_epoch: number;
  memberships: Membership[] | null;
};

// Fresh-row lookup on EVERY REQUEST — the is_active re-check is what
// makes revocation instant, and memberships now ride the same query so
// a revoked membership dies just as fast. React cache() dedupes only
// within a single request's render (page + layout share one query);
// outside a render (API routes) it is a pass-through. Never cache across
// requests (library-docs § jose).
const loadSessionAdmin = cache(async (): Promise<SessionAdmin | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const res = await pool.query<AdminRow>(
    `SELECT a.id, a.username, a.name, a.email, a.platform_role,
            a.must_change_password, a.is_active, a.session_epoch,
            COALESCE((
              SELECT json_agg(m ORDER BY m.name)
              FROM (
                SELECT 'team'::text AS kind, t.id, t.slug,
                       t.display_name AS name, tm.team_role AS role
                  FROM team_memberships tm
                  JOIN teams t ON t.id = tm.team_id
                 WHERE tm.admin_id = a.id AND tm.is_active
                UNION ALL
                SELECT 'tournament'::text AS kind, tr.id, tr.id::text AS slug,
                       tr.name, tnm.tournament_role AS role
                  FROM tournament_memberships tnm
                  JOIN tournaments tr ON tr.id = tnm.tournament_id
                 WHERE tnm.admin_id = a.id AND tnm.is_active
              ) m
            ), '[]'::json) AS memberships
       FROM admins a
      WHERE a.id = $1`,
    [payload.adminId],
  );
  const row = res.rows[0];
  if (!row || !row.is_active) return null;
  // Logout and password change bump the epoch, which is how outstanding
  // tokens are invalidated without a sessions table.
  if (!isEpochValid(payload.epoch, row.session_epoch)) return null;

  const principal: Principal = {
    id: row.id,
    platformRole: row.platform_role,
    memberships: row.memberships ?? [],
  };

  const cookieSlug = store.get(TEAM_COOKIE)?.value ?? null;
  // A megaadmin may observe a team it holds no membership in, so its slug
  // is looked up directly. Ordinary accounts never reach this query.
  let knownTeams: Map<string, string> | undefined;
  if (cookieSlug && isMegaadmin(principal)) {
    const t = await pool.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM teams WHERE slug = $1`,
      [cookieSlug],
    );
    if (t.rows[0]) knownTeams = new Map([[t.rows[0].slug, t.rows[0].id]]);
  }

  const activeTeamId = resolveActiveTeamId(principal, cookieSlug, knownTeams);
  const activeTeam =
    principal.memberships.find((m) => m.kind === "team" && m.id === activeTeamId) ??
    null;

  return {
    ...principal,
    username: row.username,
    name: row.name,
    email: row.email,
    mustChangePassword: row.must_change_password,
    activeTeamId,
    activeTeamSlug: activeTeam?.slug ?? (activeTeamId ? cookieSlug : null),
    activeTeamRole: scopeRoleFor(principal, "team", activeTeamId),
  };
});

type RequireOptions = {
  // change-password and /me must work while the forced change is pending
  allowPasswordChangePending?: boolean;
};

/**
 * Signed in, nothing more. The guard for account-level routes (signup
 * follow-ups, change password, team switch) — a fresh account holds no
 * memberships and must still be able to use them.
 */
export async function requireAccount(
  options: RequireOptions = {},
): Promise<SessionAdmin> {
  const admin = await loadSessionAdmin();
  if (!admin) {
    throw new ApiError(401, "UNAUTHORIZED", "Sign in required");
  }
  if (admin.mustChangePassword && !options.allowPasswordChangePending) {
    throw new ApiError(
      403,
      "PASSWORD_CHANGE_REQUIRED",
      "Set a new password before doing anything else",
    );
  }
  return admin;
}

export type ScopedAdmin = SessionAdmin & {
  scopeId: string;
  scopeRole: ScopeRole;
};

async function requireScope(
  kind: ScopeKind,
  scopeId: string | null,
  needSuperadmin: boolean,
  options: RequireOptions = {},
): Promise<ScopedAdmin> {
  const admin = await requireAccount(options);

  // Checked FIRST, before the active-team lookup: the platform account is
  // refused every scope write whether or not it currently has a team
  // selected, and the error should say so rather than reporting the
  // incidental NO_ACTIVE_TEAM. It reads every scope but writes none —
  // an observer, not an operator.
  if (isMegaadmin(admin)) {
    throw new ApiError(
      403,
      "MEGAADMIN_READ_ONLY",
      "The platform account cannot modify team data",
    );
  }

  const id = scopeId ?? (kind === "team" ? admin.activeTeamId : null);
  if (!id) {
    throw new ApiError(
      409,
      "NO_ACTIVE_TEAM",
      "No team selected for this account",
    );
  }
  const allowed = needSuperadmin
    ? canAdminister(admin, kind, id)
    : canWrite(admin, kind, id);
  if (!allowed) {
    const role = scopeRoleFor(admin, kind, id);
    throw role === null
      ? new ApiError(403, "NOT_A_MEMBER", "You do not have access to this team")
      : new ApiError(403, "SCOPE_FORBIDDEN", "Superadmin only");
  }
  return { ...admin, scopeId: id, scopeRole: scopeRoleFor(admin, kind, id)! };
}

export function requireTeamAdmin(
  teamId?: string | null,
  options: RequireOptions = {},
): Promise<ScopedAdmin> {
  return requireScope("team", teamId ?? null, false, options);
}

export function requireTeamSuperadmin(
  teamId?: string | null,
): Promise<ScopedAdmin> {
  return requireScope("team", teamId ?? null, true);
}

export function requireTournamentAdmin(
  tournamentId: string,
): Promise<ScopedAdmin> {
  return requireScope("tournament", tournamentId, false);
}

export function requireTournamentSuperadmin(
  tournamentId: string,
): Promise<ScopedAdmin> {
  return requireScope("tournament", tournamentId, true);
}

export async function requireMegaadmin(): Promise<SessionAdmin> {
  const admin = await requireAccount();
  if (!isMegaadmin(admin)) {
    // Not FORBIDDEN-with-detail: a non-operator should not learn that the
    // operator console exists.
    throw new ApiError(404, "NOT_FOUND", "Not found");
  }
  return admin;
}

/**
 * @deprecated Use requireTeamAdmin(). Kept so the existing route handlers
 * compile unchanged while they are swept folder by folder; it resolves to
 * the request's active team, which for a single-team account is exactly
 * the old behaviour.
 */
export function requireAdmin(
  options: RequireOptions = {},
): Promise<ScopedAdmin> {
  return requireTeamAdmin(undefined, options);
}

/** @deprecated Use requireTeamSuperadmin(). */
export function requireSuperadmin(): Promise<ScopedAdmin> {
  return requireTeamSuperadmin();
}

// Page-side variant: returns null instead of throwing Response-shaped
// errors, for server components that redirect on their own.
export async function getSessionAdmin(): Promise<SessionAdmin | null> {
  return loadSessionAdmin();
}
