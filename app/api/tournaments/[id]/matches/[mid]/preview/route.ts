import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { calculateMatchFees } from "@/engine/calc";
import { requireAdmin } from "@/lib/session";
import {
  ApiError,
  handleRouteError,
  tournamentMatchPreviewSchema,
} from "@/lib/validate";

// Stateless fee preview — the engine over the wire, no writes and no
// tournament lock (a completed tournament hard-fails at submit). The
// tournament id scopes the roster check; no guests, no captain.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = tournamentMatchPreviewSchema.parse(await req.json());

    const playerIds = [...new Set(body.attendees.map((a) => a.player_id))];
    const activeRes = await pool.query(
      `SELECT id FROM tournament_players
       WHERE id = ANY($1::uuid[]) AND tournament_id = $2 AND is_active`,
      [playerIds, id],
    );
    if (activeRes.rowCount !== playerIds.length) {
      throw new ApiError(
        422,
        "INACTIVE_PLAYER",
        "Every attendee must be an active player of this tournament",
      );
    }

    let result;
    try {
      result = calculateMatchFees({
        groundFee: body.ground_fee,
        ballFee: body.ball_fee,
        otherFee: body.other_fee,
        carAllowancePerCar: body.car_allowance_per_car,
        attendees: body.attendees.map((a) => ({
          playerId: a.player_id,
          broughtCar: a.brought_car,
        })),
        guests: [],
      });
    } catch (engineError) {
      if (engineError instanceof Error) {
        throw new ApiError(422, "INVALID_INPUT", engineError.message);
      }
      throw engineError;
    }

    return NextResponse.json({
      success: true,
      data: {
        per_player_fee: result.perPlayerFee,
        total_cost: result.totalCost,
        collected_total: result.collectedTotal,
        surplus_to_pool: result.surplusToPool,
        rows: result.rows.map((r) => ({
          player_id: r.playerId,
          brought_car: r.broughtCar,
          fee: r.fee,
        })),
        guest_rows: [],
        captain_charge: 0,
        captain_name: null,
      },
    });
  } catch (error) {
    return handleRouteError("[tournaments/matches/preview]", error);
  }
}
