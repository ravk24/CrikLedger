import { NextRequest, NextResponse } from "next/server";
import { requireTournamentWrite } from "@/lib/session";
import {
  handleRouteError,
  tournamentMatchSubmitSchema,
} from "@/lib/validate";
import { completeTournamentMatch } from "@/lib/tournamentMatches";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> },
) {
  try {
    const { id, mid } = await params;
    const admin = await requireTournamentWrite(id);
    const body = tournamentMatchSubmitSchema.parse(await req.json());
    const result = await completeTournamentMatch(id, mid, admin.id, body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleRouteError("[tournaments/matches/submit]", error);
  }
}
