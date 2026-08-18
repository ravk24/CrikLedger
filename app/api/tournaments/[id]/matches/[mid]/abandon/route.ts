import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { abandonMatchSchema, handleRouteError } from "@/lib/validate";
import { abandonTournamentMatch } from "@/lib/tournamentMatches";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id, mid } = await params;
    const { reason } = abandonMatchSchema.parse(await req.json());
    const result = await abandonTournamentMatch(admin.id, id, mid, reason);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/matches/abandon]", error);
  }
}
