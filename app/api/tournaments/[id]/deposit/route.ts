import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { handleRouteError, tournamentDepositSchema } from "@/lib/validate";
import { addDeposit } from "@/lib/tournaments";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = tournamentDepositSchema.parse(await req.json());
    const result = await addDeposit(admin.id, id, body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleRouteError("[tournaments/deposit]", error);
  }
}
