import { NextRequest, NextResponse } from "next/server";
import { pool, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getCurrentTeamId } from "@/lib/team";
import { createMatchSchema, handleRouteError } from "@/lib/validate";

// Scheduling is pay-per-ground: creating the match records the pool's
// payment too. One transaction — debit (our team's contribution only;
// the opponent's share never enters the app) -> match.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = createMatchSchema.parse(await req.json());
    const teamId = await getCurrentTeamId(pool);

    const result = await withTransaction(async (client) => {
      const message =
        `Ground fee — vs ${body.opponent}` +
        (body.venue ? ` at ${body.venue}` : "") +
        ` · paid to ${body.fee_paid_to === "owner" ? "ground owner" : "opponent"}`;
      const entryRes = await client.query(
        `INSERT INTO pool_entries (kind, message, amount, created_by, team_id)
         VALUES ('plain_debit', $1, $2, $3, $4)
         RETURNING id`,
        [message, -body.fee_amount, admin.id, teamId],
      );

      const matchRes = await client.query(
        `INSERT INTO matches
           (match_date, opponent, venue, fee_paid_to,
            other_fee_entry_id, created_by, team_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, match_date, opponent, status`,
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
  } catch (error) {
    return handleRouteError("[matches/schedule]", error);
  }
}
