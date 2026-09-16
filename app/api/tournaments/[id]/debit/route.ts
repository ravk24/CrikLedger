import { NextRequest, NextResponse } from "next/server";
import { requireTournamentWrite } from "@/lib/session";
import { handleRouteError, tournamentDebitSchema } from "@/lib/validate";
import { addDebit } from "@/lib/tournaments";

// Expense (plain or common — split across the CURRENT active roster,
// frozen at entry time) or a player withdrawal — the tournament twin
// of POST /api/pool/debit minus the season due (2026-09-16; replaced
// /expense).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = await requireTournamentWrite(id);
    const body = tournamentDebitSchema.parse(await req.json());
    const result = await addDebit(admin.id, id, body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleRouteError("[tournaments/debit]", error);
  }
}
