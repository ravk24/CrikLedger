import { NextRequest, NextResponse } from "next/server";
import { completeMatch } from "@/lib/matches";
import { requireTeamRowWrite } from "@/lib/session";
import { handleRouteError, matchSubmitSchema } from "@/lib/validate";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Authorized against the MATCH's team, not the active one (F-1).
    // completeMatch then works within match.team_id.
    const admin = await requireTeamRowWrite("matches", id);
    const body = matchSubmitSchema.parse(await req.json());
    const result = await completeMatch(id, admin.id, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[matches/submit]", error);
  }
}
