import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import {
  handleRouteError,
  tournamentScheduleMatchSchema,
} from "@/lib/validate";
import { editSchedule } from "@/lib/tournamentMatches";

// Fix a scheduled match's opponent/date/time (scheduled-only).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id, mid } = await params;
    const body = tournamentScheduleMatchSchema.parse(await req.json());
    const result = await editSchedule(admin.id, id, mid, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/matches/schedule]", error);
  }
}
