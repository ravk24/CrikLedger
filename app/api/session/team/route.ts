import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { isMegaadmin } from "@/lib/roles";
import { requireAccount, setTeamCookie } from "@/lib/session";
import { ApiError, handleRouteError, teamSwitchSchema } from "@/lib/validate";

// Switch the active team. The cookie only ever holds a slug, and every
// request re-validates it against live memberships, so this route is a
// convenience rather than the security boundary — but it still refuses
// a team the account has no claim on, so the UI fails loudly instead of
// silently falling back.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAccount();
    const { slug } = teamSwitchSchema.parse(await req.json());

    const membership = admin.memberships.find(
      (m) => m.kind === "team" && m.slug === slug,
    );

    if (!membership) {
      // The megaadmin observes any team without holding a membership.
      if (!isMegaadmin(admin)) {
        throw new ApiError(
          403,
          "NOT_A_MEMBER",
          "You do not have access to this team",
        );
      }
      const exists = await pool.query(`SELECT 1 FROM teams WHERE slug = $1`, [
        slug,
      ]);
      if (exists.rowCount === 0) {
        throw new ApiError(404, "NOT_FOUND", "No such team");
      }
    }

    await setTeamCookie(slug);
    return NextResponse.json({ success: true, data: { active_team: slug } });
  } catch (error) {
    return handleRouteError("[session/team]", error);
  }
}
