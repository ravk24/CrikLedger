import { NextRequest, NextResponse } from "next/server";
import { requireTournamentWrite } from "@/lib/session";
import { handleRouteError } from "@/lib/validate";
import { clearViceCaptain, setViceCaptain } from "@/lib/tournaments";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> },
) {
  try {
    const { id, pid } = await params;
    await requireTournamentWrite(id);
    const result = await setViceCaptain(id, pid);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/vice-captain]", error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> },
) {
  try {
    const { id, pid } = await params;
    await requireTournamentWrite(id);
    const result = await clearViceCaptain(id, pid);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/vice-captain]", error);
  }
}
