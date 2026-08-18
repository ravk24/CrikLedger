import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ApiError, abandonMatchSchema, handleRouteError } from "@/lib/validate";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { reason } = abandonMatchSchema.parse(await req.json());

    const result = await withTransaction(async (client) => {
      // Allowed from scheduled only. Home: zero financials. Away: the
      // pool-fronted ground fee returns — its debit row is deleted (the
      // FK NULLs the link), restoring the pool balance.
      const res = await client.query(
        `UPDATE matches
         SET status = 'abandoned', abandoned_reason = $2,
             updated_by = $3, updated_at = NOW()
         WHERE id = $1 AND status = 'scheduled'
         RETURNING id, status, other_fee_entry_id`,
        [id, reason, admin.id],
      );
      const row = res.rows[0];
      if (!row) {
        throw new ApiError(
          409,
          "NOT_SCHEDULED",
          "Only a scheduled match can be abandoned",
        );
      }

      let feeReverted = 0;
      if (row.other_fee_entry_id) {
        const feeRes = await client.query(
          `DELETE FROM pool_entries WHERE id = $1 RETURNING amount`,
          [row.other_fee_entry_id],
        );
        feeReverted = Math.abs(Number(feeRes.rows[0]?.amount ?? 0));
      }
      return { id: row.id, status: row.status, fee_reverted: feeReverted };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[matches/abandon]", error);
  }
}
