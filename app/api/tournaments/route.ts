import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { createTournamentSchema, handleRouteError } from "@/lib/validate";
import { createTournament } from "@/lib/tournaments";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = createTournamentSchema.parse(await req.json());
    const result = await createTournament(admin.id, body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleRouteError("[tournaments]", error);
  }
}
