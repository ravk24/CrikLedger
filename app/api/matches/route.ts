import { NextRequest, NextResponse } from "next/server";
import { pool, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getCurrentTeamId } from "@/lib/team";
import { handleRouteError, scheduleMatchSchema } from "@/lib/validate";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = scheduleMatchSchema.parse(await req.json());
    const teamId = await getCurrentTeamId(pool);

    if (body.ground === "other") {
      // Away matches are pay-per-ground: scheduling records the pool's
      // payment too. One transaction — debit (our team's contribution
      // only; the opponent's share never enters the app) -> match.
      const result = await withTransaction(async (client) => {
        const message =
          `Ground fee — vs ${body.opponent}` +
          (body.venue ? ` at ${body.venue}` : "") +
          ` · paid to ${body.fee_paid_to === "owner" ? "ground owner" : "opponent"}`;
        const entryRes = await client.query(
          `INSERT INTO pool_entries (kind, message, amount, created_by, team_id)
           VALUES ('plain_debit', $1, $2, $3, $4)
           RETURNING id`,
          [message, -body.fee_amount!, admin.id, teamId],
        );

        const matchRes = await client.query(
          `INSERT INTO matches
             (match_date, opponent, ground, venue, fee_paid_to,
              other_fee_entry_id, created_by, team_id)
           VALUES ($1, $2, 'other', $3, $4, $5, $6, $7)
           RETURNING id, match_date, opponent, status, ground`,
          [
            body.match_date,
            body.opponent,
            body.venue ?? null,
            body.fee_paid_to,
            entryRes.rows[0].id,
            admin.id,
            teamId,
          ],
        );
        return { ...matchRes.rows[0], fee_recorded: body.fee_amount };
      });
      return NextResponse.json({ success: true, data: result }, { status: 201 });
    }

    const res = await pool.query(
      `INSERT INTO matches (match_date, opponent, ground, created_by, team_id)
       VALUES ($1, $2, 'barne', $3, $4)
       RETURNING id, match_date, opponent, status, ground`,
      [body.match_date, body.opponent, admin.id, teamId],
    );
    return NextResponse.json(
      { success: true, data: res.rows[0] },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError("[matches/schedule]", error);
  }
}
