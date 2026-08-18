import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireTeamSuperadmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

// Un-revoke a team membership. The temp password stays whatever it was —
// pair with reset-password if they've forgotten it.
//
// A restore has to re-claim an admin slot, so it can fail with
// TEAM_ADMIN_LIMIT if two other admins were appointed meanwhile.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const superadmin = await requireTeamSuperadmin();
    const { id } = await params;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT 1 FROM teams WHERE id = $1 FOR UPDATE`, [
        superadmin.scopeId,
      ]);

      const used = await client.query<{ admin_slot: number }>(
        `SELECT admin_slot FROM team_memberships
          WHERE team_id = $1 AND team_role = 'admin' AND is_active`,
        [superadmin.scopeId],
      );
      const taken = new Set(used.rows.map((r) => r.admin_slot));
      const slot = [1, 2].find((n) => !taken.has(n));
      if (!slot) {
        throw new ApiError(
          409,
          "TEAM_ADMIN_LIMIT",
          "This team already has two admins — revoke one first",
        );
      }

      const res = await client.query(
        `UPDATE team_memberships
            SET is_active = TRUE, revoked_at = NULL, admin_slot = $3
          WHERE team_id = $1 AND admin_id = $2 AND team_role = 'admin'
        RETURNING admin_id AS id`,
        [superadmin.scopeId, id, slot],
      );
      if (res.rowCount === 0) {
        throw new ApiError(404, "NOT_FOUND", "Not a member of this team");
      }

      const who = await client.query(
        `SELECT id, username, name FROM admins WHERE id = $1`,
        [id],
      );
      await client.query("COMMIT");
      return NextResponse.json({ success: true, data: who.rows[0] });
    } catch (err) {
      await client.query("ROLLBACK");
      if ((err as { code?: string }).code === "23505") {
        throw new ApiError(
          409,
          "TEAM_ADMIN_LIMIT",
          "This team already has two admins — revoke one first",
        );
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return handleRouteError("[sa/admins/restore]", error);
  }
}
