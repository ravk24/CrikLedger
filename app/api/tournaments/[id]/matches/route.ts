import { NextRequest, NextResponse } from "next/server";
import { requireTournamentWrite } from "@/lib/session";
import {
  handleRouteError,
  tournamentScheduleMatchSchema,
} from "@/lib/validate";
import { scheduleMatch } from "@/lib/tournamentMatches";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = await requireTournamentWrite(id);
    const body = tournamentScheduleMatchSchema.parse(await req.json());
    const result = await scheduleMatch(admin.id, id, body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleRouteError("[tournaments/matches]", error);
  }
}
