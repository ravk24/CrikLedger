import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { handleRouteError } from "@/lib/validate";
import { clearCaptain, setCaptain } from "@/lib/tournaments";

// Tournament captain — declared by any admin (unlike the SG captain,
// which is superadmin-only). No body; ids come from the params.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> },
) {
  try {
    await requireAdmin();
    const { id, pid } = await params;
    const result = await setCaptain(id, pid);
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
    await requireAdmin();
    const { id, pid } = await params;
    const result = await clearCaptain(id, pid);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/captain]", error);
  }
}
