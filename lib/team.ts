import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { supabaseServer } from "@/lib/supabase-server";
import { ApiError } from "@/lib/validate";
import { getSessionAdmin } from "@/lib/session";

// Multi-team resolution (Feature 4). There is deliberately NO current-team
// constant and NO cross-request memo any more: under multi-team, a module
// level memo would serve the first request's tenant id to every later
// request, which is a cross-tenant leak rather than an optimisation.
//
// The active team comes from the session (the cl_team cookie, re-validated
// against memberships on every request). Pages that render a specific
// resource — a match sheet, a player — take the team from the RESOURCE
// instead, via getTeamById(), which is what lets those pages stay public
// without a session.

// The columns the app reads. teams_public also carries meeting_point,
// status_threshold (read by the players_public CASE in SQL, never here),
// brand_*, logo_ref and is_sandbox — declared nowhere in TS because no
// component reads them.
export type TeamPublic = {
  id: string;
  slug: string;
  display_name: string;
  car_rate_per_km: number;
  created_at: string;
};

const TEAM_COLUMNS = "id, slug, display_name, car_rate_per_km, created_at";

// Team config is near-immutable and carries no money, so it is the one
// row this app caches: the anonymous /matches/[id] share link (the only
// caller left after the member's row started riding the session query)
// no longer pays a PostgREST hop for it. PATCH /api/sa/team revalidates
// the tag, so a rename shows on the next request.
async function loadTeamRow(teamId: string): Promise<TeamPublic | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`team:${teamId}`);
  const { data, error } = await supabaseServer
    .from("teams_public")
    .select(TEAM_COLUMNS)
    .eq("id", teamId)
    .maybeSingle();
  if (error) throw new Error(`Team '${teamId}' lookup failed: ${error.message}`);
  return (data as TeamPublic | null) ?? null;
}

export const getTeamById = cache(async (teamId: string): Promise<TeamPublic> => {
  const team = await loadTeamRow(teamId);
  if (!team) throw new Error(`Team '${teamId}' not found`);
  return team;
});

/**
 * The signed-in user's active team, or null for a guest / an account with
 * no memberships. Server Components use this; it never throws, so a page
 * can render its signed-out state instead.
 */
export const getActiveTeam = cache(async (): Promise<TeamPublic | null> => {
  const admin = await getSessionAdmin();
  if (!admin?.activeTeamId) return null;
  // The member's team row already arrived with the session; only a
  // megaadmin observing a foreign team still needs the lookup.
  return admin.activeTeam ?? getTeamById(admin.activeTeamId);
});

/**
 * The active team's id for write paths. Throws the same Response-shaped
 * errors the guards do.
 *
 * Note it takes no pg client: the id already arrived with the session row,
 * so this issues no query. That also removes the old hazard of running a
 * `pool` query while a PoolClient transaction was open.
 */
export async function getActiveTeamId(): Promise<string> {
  const admin = await getSessionAdmin();
  if (!admin) throw new ApiError(401, "UNAUTHORIZED", "Sign in required");
  if (!admin.activeTeamId) {
    throw new ApiError(409, "NO_ACTIVE_TEAM", "No team selected for this account");
  }
  return admin.activeTeamId;
}

/**
 * @deprecated Use getActiveTeamId(). Kept with its old call signature so
 * the existing route handlers compile unchanged while they are swept; the
 * `q` argument is ignored because no query is needed any more.
 */
// The pg client argument is accepted and ignored so the ~20 existing
// call sites keep compiling until they are swept to getActiveTeamId().
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getCurrentTeamId(_q?: unknown): Promise<string> {
  return getActiveTeamId();
}

/**
 * @deprecated Use getActiveTeam() (nullable) or getTeamById(resourceTeamId)
 * on public resource pages.
 */
export async function getCurrentTeam(): Promise<TeamPublic> {
  const team = await getActiveTeam();
  if (!team) {
    throw new ApiError(409, "NO_ACTIVE_TEAM", "No team selected for this account");
  }
  return team;
}
