import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { handleRouteError } from "@/lib/validate";
import { clearViceCaptain, setViceCaptain } from "@/lib/tournaments";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> },
) {
  try {
    await requireAdmin();
    const { id, pid } = await params;
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
    await requireAdmin();
    const { id, pid } = await params;
    const result = await clearViceCaptain(id, pid);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/vice-captain]", error);
  }
}
