import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";
import { handleRouteError } from "@/lib/validate";

export async function POST() {
  try {
    await clearSessionCookie();
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleRouteError("[auth/logout]", error);
  }
}
