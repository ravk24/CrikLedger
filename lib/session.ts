import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  TEAM_COOKIE,
} from "@/lib/cookies";
import { pool } from "@/lib/db";
import { ApiError } from "@/lib/validate";
import type { TeamPublic } from "@/lib/team";
import {
  canAdminister,
  canWrite,
  isEpochValid,
  isMegaadmin,
  isViewer,
  resolveActiveTeamId,
  type EntitlementSummary,
  scopeRoleFor,
  type Membership,
  type Principal,
  type ScopeKind,
  type ScopeRole,
} from "@/lib/roles";
import { isSeatId, seatCheckPasses } from "@/lib/viewerSeats";

export { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, TEAM_COOKIE };
const SESSION_MAX_AGE_JWT = "30d"; // keep in step with SESSION_MAX_AGE_SECONDS

// Not `process.env.SESSION_SECRET!`: undefined encodes to a zero-length
// key, and jose then fails inside its own crypto layer, so the log line
// blames a CryptoKey rather than the variable that is actually missing.
// Sign-in is the only path that reaches this on a healthy deployment —
// signed-out reads never verify a token — so without this the whole site
// looks fine and only logging in breaks.
const secret = () => {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error(
      "SESSION_SECRET is not set — sessions cannot be signed or verified.",
    );
  }
  return new TextEncoder().encode(value);
};

// The token carries identity and nothing else. Roles deliberately LEFT
// the payload at migration 32: they now live in membership rows that can
// be revoked mid-session, and a role baked into a 30-day cookie cannot.
// `sid` is the one addition (migration 52): only the team viewer's
// tokens carry it — the viewer_sessions row this sign-in claimed — and
// the row's disappearance is how one phone is signed out.
export type SessionPayload = {
  adminId: string;
  epoch: number;
  sid?: string;
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
  /**
   * The active team's config row, when the account is a member of it.
   * Rides the session query so pages skip a serial teams_public hop;
   * null for a megaadmin observing a team it holds no membership in
   * (lib/team.ts falls back to a lookup for that case).
   */
  activeTeam: TeamPublic | null;
  /** The viewer's seat row (migration 52); null on every other account. */
  seatId: string | null;
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

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.adminId !== "string") return null;
    // Pre-migration-32 tokens carry `role` and no `epoch`; they fail here
    // and the holder simply signs in again.
    if (typeof payload.epoch !== "number") return null;
    // A malformed seat id is treated as absent, so it never reaches a
    // ::uuid cast — a viewer token without a seat is refused downstream.
    const sid = isSeatId(payload.sid) ? payload.sid : undefined;
    return { adminId: payload.adminId, epoch: payload.epoch, sid };
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
  seat_alive: boolean;
  memberships: Membership[] | null;
  entitlements: EntitlementSummary[] | null;
  teams: TeamPublic[] | null;
};

// Fresh-row lookup on EVERY REQUEST — the is_active re-check is what
// makes revocation instant, and memberships now ride the same query so
// a revoked membership dies just as fast. The viewer's seat row rides
// it too (one PK probe, skipped when the token has no `sid`): deleting
// the row signs out that one phone. React cache() dedupes only
// within a single request's render (page + layout share one query);
// outside a render (API routes) it is a pass-through. Never cache across
// requests (library-docs § jose).
const loadSessionAdmin = cache(async (): Promise<SessionAdmin | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  // my_teams is the caller's active team memberships, computed once and
  // read by two of the three aggregates below (it used to be spelled
  // out three times). This statement is on the critical path of every
  // dynamic render in the app.
  const res = await pool.query<AdminRow>(
    `WITH my_teams AS MATERIALIZED (
       SELECT tm.team_id FROM team_memberships tm
        WHERE tm.admin_id = $1 AND tm.is_active
     )
     SELECT a.id, a.username, a.name, a.email, a.platform_role,
            a.must_change_password, a.is_active, a.session_epoch,
            ($2::uuid IS NOT NULL AND EXISTS (
              SELECT 1 FROM viewer_sessions vs
               WHERE vs.id = $2::uuid AND vs.admin_id = a.id
            )) AS seat_alive,
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
            ), '[]'::json) AS memberships,
            COALESCE((
              SELECT json_agg(e)
              FROM (
                SELECT en.team_id AS "teamId", en.product,
                       count(*)::int AS total,
                       count(*) FILTER (WHERE en.consumed_at IS NULL)::int AS unused
                  FROM entitlements en
                 WHERE en.team_id IN (SELECT team_id FROM my_teams)
                 GROUP BY en.team_id, en.product
              ) e
            ), '[]'::json) AS entitlements,
            COALESCE((
              SELECT json_agg(tp)
                FROM teams_public tp
               WHERE tp.id IN (SELECT team_id FROM my_teams)
            ), '[]'::json) AS teams
       FROM admins a
      WHERE a.id = $1`,
    [payload.adminId, payload.sid ?? null],
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
    entitlements: row.entitlements ?? [],
  };

  // The viewer's per-seat lever (migration 52). Needs memberships, so it
  // comes after the principal: a viewer token must name a live seat, and
  // any token naming a seat is good only while that row exists.
  if (
    !seatCheckPasses({
      isViewer: isViewer(principal),
      sid: payload.sid,
      seatAlive: row.seat_alive,
    })
  ) {
    return null;
  }

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
    activeTeam:
      (row.teams ?? []).find((t) => t.id === activeTeamId) ?? null,
    seatId: payload.sid ?? null,
  };
});

type RequireOptions = {
  // change-password and /me must work while the forced change is pending
  allowPasswordChangePending?: boolean;
};

// The shared team-viewer login attempted a write. One code for every
// surface — pool, matches, players, tournaments, share images, export,
// password change — so the UI can say the same thing everywhere.
export function viewerReadOnlyError(): ApiError {
  return new ApiError(
    403,
    "VIEWER_READ_ONLY",
    "The team viewer login can only view — it cannot change anything",
  );
}

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
    if (role === null) {
      throw new ApiError(403, "NOT_A_MEMBER", "You do not have access to this team");
    }
    if (role === "viewer") throw viewerReadOnlyError();
    throw new ApiError(403, "SCOPE_FORBIDDEN", "Superadmin only");
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

/**
 * Write guard for a tournament named in the URL. Resolves the
 * tournament's OWN scope — its hosting team, or the tournament itself
 * when a Tournament-Credit buyer owns no team — and checks the caller can
 * write that scope. This is the rule the tournament Admin tab applies on
 * the read side; the API routes used to call requireAdmin(), which only
 * proved the caller could write their own active team and never tied the
 * URL's tournament to it.
 *
 * scopeId / scopeRole describe the tournament's scope (team id for a
 * hosted tournament), so `admin.scopeRole === "superadmin"` keeps meaning
 * "purchaser of this tournament".
 */
export async function requireTournamentWrite(
  tournamentId: string,
  { superadmin = false, ...options }: RequireOptions & { superadmin?: boolean } = {},
): Promise<ScopedAdmin> {
  const admin = await requireAccount(options);
  if (isMegaadmin(admin)) {
    throw new ApiError(
      403,
      "MEGAADMIN_READ_ONLY",
      "The platform account cannot modify team data",
    );
  }
  const res = await pool.query<{ id: string; team_id: string | null }>(
    `SELECT id, team_id FROM tournaments WHERE id = $1`,
    [tournamentId],
  );
  const row = res.rows[0];
  if (!row) throw new ApiError(404, "NOT_FOUND", "Tournament not found");
  const kind: ScopeKind = row.team_id ? "team" : "tournament";
  const scopeId = row.team_id ?? row.id;
  if (scopeRoleFor(admin, kind, scopeId) === "viewer") {
    throw viewerReadOnlyError();
  }
  if (!canWrite(admin, kind, scopeId)) {
    throw new ApiError(
      403,
      "NOT_A_MEMBER",
      "You do not have access to this tournament",
    );
  }
  if (superadmin && !canAdminister(admin, kind, scopeId)) {
    throw new ApiError(403, "SCOPE_FORBIDDEN", "Superadmin only");
  }
  return { ...admin, scopeId, scopeRole: scopeRoleFor(admin, kind, scopeId)! };
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
