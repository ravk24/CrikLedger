import { cache } from "react";
import type { Pool, PoolClient } from "pg";
import type { Ground } from "@/lib/grounds";
import { supabasePublic } from "@/lib/supabase-public";

// Interim single-team resolution (Feature 2 tenancy step). Every read
// filters and every write stamps team_id, but the CURRENT team is still
// a constant — the /[team]/ slug routing arrives later in Feature 2,
// and "which teams does this login see" is the Feature 4 auth model.
export const CURRENT_TEAM_SLUG = "our-xi";

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

// Server Components: the current team via the anon client, deduped per
// request render with React cache().
export const getCurrentTeam = cache(async (): Promise<TeamPublic> => {
  const { data, error } = await supabasePublic
    .from("teams_public")
    .select("*")
    .eq("slug", CURRENT_TEAM_SLUG)
    .single();
  if (error || !data) {
    throw new Error(
      `Team '${CURRENT_TEAM_SLUG}' not found — did migration-26 run? ${error?.message ?? ""}`,
    );
  }
  return data as TeamPublic;
});

// The team's active grounds as the UI's Ground shape (name + per-car
// allowance), replacing the old lib/grounds.ts GROUNDS literal. Deduped
// per request render like getCurrentTeam.
export const getTeamGrounds = cache(async (): Promise<Ground[]> => {
  const team = await getCurrentTeam();
  const { data, error } = await supabasePublic
    .from("team_grounds_public")
    .select("name, car_allowance, sort_order")
    .eq("team_id", team.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    throw new Error(`Could not load team grounds: ${error.message}`);
  }
  return (data ?? []).map((g) => ({
    name: g.name as string,
    allowance: Number(g.car_allowance),
  }));
});

export type TeamSlot = {
  slot_date: string; // yyyy-mm-dd
  season_label: string;
  starts_on: string;
  ends_on: string;
};

// The team's bookable slot dates with their season window, replacing
// the old lib/groundSlots.ts GROUND_SLOTS literal.
export const getTeamSlots = cache(async (): Promise<TeamSlot[]> => {
  const team = await getCurrentTeam();
  const { data, error } = await supabasePublic
    .from("team_slots_public")
    .select("slot_date, season_label, starts_on, ends_on")
    .eq("team_id", team.id)
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
});

// API routes / lib code on the pg pool. Team ids are immutable, so a
// module-level memo is safe across requests.
let teamIdMemo: string | null = null;
export async function getCurrentTeamId(
  q: Pool | PoolClient,
): Promise<string> {
  if (teamIdMemo) return teamIdMemo;
  const res = await q.query(`SELECT id FROM teams WHERE slug = $1`, [
    CURRENT_TEAM_SLUG,
  ]);
  const id: string | undefined = res.rows[0]?.id;
  if (!id) {
    throw new Error(
      `Team '${CURRENT_TEAM_SLUG}' not found — did migration-26 run?`,
    );
  }
  teamIdMemo = id;
  return id;
}
