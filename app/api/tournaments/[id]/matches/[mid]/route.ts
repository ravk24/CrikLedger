import { NextRequest, NextResponse } from "next/server";
import { requireTournamentWrite } from "@/lib/session";
import {
  handleRouteError,
  tournamentMatchSubmitSchema,
} from "@/lib/validate";
import {
  completeTournamentMatch,
  deleteTournamentMatch,
} from "@/lib/tournamentMatches";

// Editing a completed tournament match = the same completion flow.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> },
) {
  try {
    const { id, mid } = await params;
    const admin = await requireTournamentWrite(id);
    const body = tournamentMatchSubmitSchema.parse(await req.json());
    const result = await completeTournamentMatch(id, mid, admin.id, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/matches/edit]", error);
  }
}

// Reverses everything via FK cascades (participants + fund credit).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> },
) {
  try {
    const { id, mid } = await params;
    await requireTournamentWrite(id, { superadmin: true });
    const result = await deleteTournamentMatch(id, mid);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/matches/delete]", error);
  }
}
