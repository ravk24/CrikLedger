import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { handleRouteError } from "@/lib/validate";

export async function GET() {
  try {
    // requireAccount, not requireTeamAdmin: a freshly signed-up account
    // holds no memberships yet and must still be able to identify itself.
    const admin = await requireAccount({ allowPasswordChangePending: true });
    return NextResponse.json({
      success: true,
      data: {
        admin_id: admin.id,
        name: admin.name,
        platform_role: admin.platformRole,
        active_team: admin.activeTeamSlug,
        team_role: admin.activeTeamRole,
        force_change: admin.mustChangePassword,
      },
    });
  } catch (error) {
    return handleRouteError("[auth/me]", error);
  }
}
