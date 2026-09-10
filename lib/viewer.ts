import { SESSION_MAX_AGE_SECONDS } from "@/lib/cookies";
import { pool } from "@/lib/db";
import type { ViewerRow } from "@/lib/viewerSeats";

// The superadmin's view of the team viewer: the credential plus its
// live seats (migration 52). Shared by GET /api/sa/viewer and the
// Manage admins page. A seat older than the session lifetime belongs
// to a token that no longer verifies, so it is hidden here even before
// the next viewer login reaps it.
export async function loadViewerCard(teamId: string): Promise<ViewerRow | null> {
  const res = await pool.query<ViewerRow>(
    `SELECT a.username, m.created_at::text AS created_at,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'id', vs.id,
                       'started_at', vs.started_at::text,
                       'device', vs.device)
                     ORDER BY vs.started_at)
                FROM viewer_sessions vs
               WHERE vs.admin_id = a.id
                 AND vs.started_at > NOW() - make_interval(secs => $2)
            ), '[]'::json) AS seats
       FROM team_memberships m
       JOIN admins a ON a.id = m.admin_id
      WHERE m.team_id = $1 AND m.team_role = 'viewer' AND m.is_active`,
    [teamId, SESSION_MAX_AGE_SECONDS],
  );
  return res.rows[0] ?? null;
}
