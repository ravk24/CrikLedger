import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";
import { formatRupees } from "@/lib/format";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const result = await withTransaction(async (client) => {
      const balRes = await client.query(
        `SELECT p.name, p.is_captain, p.is_vice_captain, b.balance FROM players p
         JOIN player_balances b ON b.id = p.id
         WHERE p.id = $1`,
        [id],
      );
      const row = balRes.rows[0];
      if (!row) {
        throw new ApiError(404, "NOT_FOUND", "Player not found");
      }
      if (row.is_captain) {
        throw new ApiError(
          409,
          "IS_CAPTAIN",
          `${row.name} is the captain — transfer captaincy first, then deactivate`,
        );
      }
      if (row.is_vice_captain) {
        throw new ApiError(
          409,
          "IS_VICE_CAPTAIN",
          `${row.name} is the vice-captain — transfer the role first, then deactivate`,
        );
      }
      const balance = Number(row.balance);
      if (balance !== 0) {
        const direction = balance > 0 ? "credit" : "debt";
        throw new ApiError(
          409,
          "NONZERO_BALANCE",
          `${row.name} still has a balance of ${balance < 0 ? "−" : ""}₹${formatRupees(balance)} (${direction}) — record the settlement entry in the pool first, then deactivate`,
        );
      }
      await client.query(`UPDATE players SET is_active = FALSE WHERE id = $1`, [
        id,
      ]);
      return { id, name: row.name };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[players/deactivate]", error);
  }
}
