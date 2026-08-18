import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { handleRouteError } from "@/lib/validate";

export async function GET() {
  try {
    const admin = await requireAdmin({ allowPasswordChangePending: true });
    return NextResponse.json({
      success: true,
      data: {
        admin_id: admin.id,
        name: admin.name,
        role: admin.role,
        force_change: admin.mustChangePassword,
      },
    });
  } catch (error) {
    return handleRouteError("[auth/me]", error);
  }
}
