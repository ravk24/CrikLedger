import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { completeMatch } from "@/lib/matches";
import { requireTeamRowWrite } from "@/lib/session";
import { ApiError, handleRouteError, matchSubmitSchema } from "@/lib/validate";

// Edit — identical payload and semantics to submit.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Authorized against the MATCH's team, not the active one (F-1).
    const admin = await requireTeamRowWrite("matches", id);
    const body = matchSubmitSchema.parse(await req.json());
    const result = await completeMatch(id, admin.id, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[matches/edit]", error);
  }
}

// Superadmin only — destructive. Participants and the collection row
// cascade via FKs.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Superadmin of the MATCH's team, not of the active one (F-1).
    const admin = await requireTeamRowWrite("matches", id, { superadmin: true });

    await withTransaction(async (client) => {
      const cur = await client.query(
        `SELECT other_fee_entry_id, pending_cleared_entry_id, refund_entry_id
         FROM matches WHERE id = $1 AND team_id = $2 FOR UPDATE`,
        [id, admin.scopeId],
      );
      const match = cur.rows[0];
      if (!match) {
        throw new ApiError(404, "NOT_FOUND", "Match not found");
      }
      await client.query(`DELETE FROM matches WHERE id = $1`, [id]);
      // Participants and the collection credit cascade with the match;
      // deleting every linked entry — settled fee, cleared-pending fee,
      // and an abandoned match's refund — completes the full reversal
      // in either direction: the pool ends where it was before scheduling.
      const entryIds = [
        match.other_fee_entry_id,
        match.pending_cleared_entry_id,
        match.refund_entry_id,
      ].filter((x): x is string => Boolean(x));
      if (entryIds.length > 0) {
        await client.query(
          `DELETE FROM pool_entries WHERE id = ANY($1::uuid[])`,
          [entryIds],
        );
      }
    });

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleRouteError("[matches/delete]", error);
  }
}
