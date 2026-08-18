import { NextRequest, NextResponse } from "next/server";
import { completeMatch } from "@/lib/matches";
import { requireAdmin } from "@/lib/session";
import { handleRouteError, matchSubmitSchema } from "@/lib/validate";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = matchSubmitSchema.parse(await req.json());
    const result = await completeMatch(id, admin.id, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[matches/submit]", error);
  }
}
