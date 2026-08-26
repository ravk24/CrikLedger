import { NextRequest, NextResponse } from "next/server";
import { requireTournamentWrite } from "@/lib/session";
import { abandonMatchSchema, handleRouteError } from "@/lib/validate";
import { abandonTournamentMatch } from "@/lib/tournamentMatches";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> },
) {
  try {
    const { id, mid } = await params;
    const admin = await requireTournamentWrite(id);
    const { reason } = abandonMatchSchema.parse(await req.json());
    const result = await abandonTournamentMatch(admin.id, id, mid, reason);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/matches/abandon]", error);
  }
}
