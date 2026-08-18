import { cache } from "react";
import type { Pool, PoolClient } from "pg";
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
