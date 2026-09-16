import { NextRequest, NextResponse } from "next/server";
import { requireTournamentWrite } from "@/lib/session";
import { handleRouteError, tournamentCreditSchema } from "@/lib/validate";
import { addCredit } from "@/lib/tournaments";

// Player deposit or other income — the tournament twin of
// POST /api/pool/credit (2026-09-16; replaced /deposit).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = await requireTournamentWrite(id);
    const body = tournamentCreditSchema.parse(await req.json());
    const result = await addCredit(admin.id, id, body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleRouteError("[tournaments/credit]", error);
  }
}
