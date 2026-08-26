import { NextRequest, NextResponse } from "next/server";
import { requireTournamentWrite } from "@/lib/session";
import { addTournamentPlayerSchema, handleRouteError } from "@/lib/validate";
import { addPlayer } from "@/lib/tournaments";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireTournamentWrite(id);
    const body = addTournamentPlayerSchema.parse(await req.json());
    const result = await addPlayer(id, body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleRouteError("[tournaments/players]", error);
  }
}
