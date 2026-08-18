import { NextRequest, NextResponse } from "next/server";
import { calculateMatchFees } from "@/engine/calc";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getCurrentTeamId } from "@/lib/team";
import { ApiError, handleRouteError, matchPreviewSchema } from "@/lib/validate";

// The calc engine over the wire — NO writes. Called on every wizard
// step 2-4 change.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    void id; // the preview is stateless; the id only scopes the URL
    const body = matchPreviewSchema.parse(await req.json());

    const teamId = await getCurrentTeamId(pool);
    const playerIds = [...new Set(body.attendees.map((a) => a.player_id))];
    const activeRes = await pool.query(
      `SELECT id FROM players
       WHERE id = ANY($1::uuid[]) AND team_id = $2 AND is_active`,
      [playerIds, teamId],
    );
    if (activeRes.rowCount !== playerIds.length) {
      throw new ApiError(
        422,
        "INACTIVE_PLAYER",
        "Every attendee must be an active player",
      );
    }

    // Guests need a standing captain to absorb their fees — fail at
    // preview so the wizard surfaces it before submit.
    let captain: { id: string; name: string } | null = null;
    if (body.guests.length > 0) {
      const capRes = await pool.query(
        `SELECT id, name FROM players
         WHERE team_id = $1 AND is_captain AND is_active`,
        [teamId],
      );
      captain = capRes.rows[0] ?? null;
      if (!captain) {
        throw new ApiError(
          422,
          "NO_CAPTAIN",
          "Declare a captain first (superadmin → Players) — guest fees are deducted from the captain",
        );
      }
    }

    try {
      const result = calculateMatchFees({
        groundFee: body.ground_fee,
        ballFee: body.ball_fee,
        otherFee: body.other_fee,
        carAllowancePerCar: body.car_allowance_per_car,
        attendees: body.attendees.map((a) => ({
          playerId: a.player_id,
          broughtCar: a.brought_car,
        })),
        guests: body.guests.map((g) => ({
          name: g.name,
          broughtCar: g.brought_car,
        })),
      });
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
          guest_rows: result.guestRows.map((g) => ({
            name: g.name,
            brought_car: g.broughtCar,
            fee: g.fee,
          })),
          captain_charge: result.captainCharge,
          captain_name: captain?.name ?? null,
        },
      });
    } catch (engineError) {
      if (engineError instanceof Error) {
        throw new ApiError(422, "INVALID_INPUT", engineError.message);
      }
      throw engineError;
    }
  } catch (error) {
    return handleRouteError("[matches/preview]", error);
  }
}
