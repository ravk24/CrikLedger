import { cache } from "react";
import type { Ground } from "@/lib/grounds";
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

export type TeamPublic = {
  id: string;
  slug: string;
  display_name: string;
  short_name: string | null;
  home_ground_name: string | null;
  home_ground_label: string | null;
  meeting_point: string | null;
  status_threshold: number;
  car_rate_per_km: number;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  logo_ref: string | null;
  is_sandbox: boolean;
  created_at: string;
};

export const getTeamById = cache(async (teamId: string): Promise<TeamPublic> => {
  const { data, error } = await supabaseServer
    .from("teams_public")
    .select("*")
    .eq("id", teamId)
    .single();
  if (error || !data) {
    throw new Error(`Team '${teamId}' not found: ${error?.message ?? ""}`);
  }
  return data as TeamPublic;
});

export const getTeamBySlug = cache(
  async (slug: string): Promise<TeamPublic | null> => {
    const { data, error } = await supabaseServer
      .from("teams_public")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(`Could not load team '${slug}': ${error.message}`);
    return (data as TeamPublic) ?? null;
  },
);

/**
 * The signed-in user's active team, or null for a guest / an account with
 * no memberships. Server Components use this; it never throws, so a page
 * can render its signed-out state instead.
 */
export const getActiveTeam = cache(async (): Promise<TeamPublic | null> => {
  const admin = await getSessionAdmin();
  if (!admin?.activeTeamId) return null;
  return getTeamById(admin.activeTeamId);
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

// The team's active grounds as the UI's Ground shape (name + per-car
// allowance), replacing the old lib/grounds.ts GROUNDS literal.
export const getTeamGrounds = cache(
  async (teamId: string): Promise<Ground[]> => {
    const { data, error } = await supabaseServer
      .from("team_grounds_public")
      .select("name, car_allowance, sort_order")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) {
      throw new Error(`Could not load team grounds: ${error.message}`);
    }
    return (data ?? []).map((g) => ({
      name: g.name as string,
      allowance: Number(g.car_allowance),
    }));
  },
);

export type TeamSlot = {
  slot_date: string; // yyyy-mm-dd
  season_label: string;
  starts_on: string;
  ends_on: string;
};

// The team's bookable slot dates with their season window, replacing
// the old lib/groundSlots.ts GROUND_SLOTS literal.
export const getTeamSlots = cache(
  async (teamId: string): Promise<TeamSlot[]> => {
    const { data, error } = await supabaseServer
      .from("team_slots_public")
      .select("slot_date, season_label, starts_on, ends_on")
      .eq("team_id", teamId)
      .order("slot_date", { ascending: true });
    if (error) {
      throw new Error(`Could not load team slots: ${error.message}`);
    }
    return (data ?? []).map((s) => ({
      slot_date: String(s.slot_date).slice(0, 10),
      season_label: s.season_label as string,
      starts_on: String(s.starts_on).slice(0, 10),
      ends_on: String(s.ends_on).slice(0, 10),
    }));
  },
);
