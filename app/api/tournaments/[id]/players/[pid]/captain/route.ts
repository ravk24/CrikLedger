import { NextRequest, NextResponse } from "next/server";
import { requireTournamentWrite } from "@/lib/session";
import { captainPhoneSchema, handleRouteError } from "@/lib/validate";
import { clearCaptain, setCaptain } from "@/lib/tournaments";

// Tournament captain — declared by any admin (unlike the SG captain,
// which is superadmin-only). Ids come from the params; the body is
// optional — the plain toggle sends none. phone null clears,
// undefined leaves the stored number untouched.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> },
) {
  try {
    const { id, pid } = await params;
    await requireTournamentWrite(id);
    const body = captainPhoneSchema.parse(await req.json().catch(() => ({})));
    const result = await setCaptain(id, pid, body.phone);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/captain]", error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> },
) {
  try {
    const { id, pid } = await params;
    await requireTournamentWrite(id);
    const result = await clearCaptain(id, pid);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/captain]", error);
  }
}
