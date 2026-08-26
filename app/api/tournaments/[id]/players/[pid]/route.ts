import { NextRequest, NextResponse } from "next/server";
import { requireTournamentWrite } from "@/lib/session";
import { handleRouteError } from "@/lib/validate";
import { removePlayer } from "@/lib/tournaments";

// Zero-balance guardrail inside; soft-removes players with history,
// hard-deletes rowless typo entries.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> },
) {
  try {
    const { id, pid } = await params;
    await requireTournamentWrite(id);
    const result = await removePlayer(id, pid);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/players/remove]", error);
  }
}
