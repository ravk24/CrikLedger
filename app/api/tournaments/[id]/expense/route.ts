import { NextRequest, NextResponse } from "next/server";
import { requireTournamentWrite } from "@/lib/session";
import { handleRouteError, tournamentExpenseSchema } from "@/lib/validate";
import { addExpense } from "@/lib/tournaments";

// Splits across the tournament's CURRENT active roster; the split
// freezes at entry time (late joiners owe nothing).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = await requireTournamentWrite(id);
    const body = tournamentExpenseSchema.parse(await req.json());
    const result = await addExpense(admin.id, id, body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleRouteError("[tournaments/expense]", error);
  }
}
