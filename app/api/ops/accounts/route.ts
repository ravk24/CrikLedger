import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireMegaadmin } from "@/lib/session";
import { handleRouteError } from "@/lib/validate";

// Customer directory for the grant picker: every active user account
// with the team it owns and what it already holds. One login per
// person is the rule — a purchase attaches to this account, it never
// mints another. Megaadmins are excluded (they cannot own a team).
//
// ?q= matches user id, name or email, because the customer is told to
// send their email with the payment and the operator may only have that.
export type OpsAccount = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  team_name: string | null;
  has_ledger: boolean;
  credits_total: number;
  credits_unused: number;
};

export async function GET(req: NextRequest) {
  try {
    await requireMegaadmin();
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

    const res = await pool.query<OpsAccount>(
      `SELECT a.id, a.username, a.name, a.email,
              t.display_name AS team_name,
              EXISTS (SELECT 1 FROM entitlements e
                       WHERE e.admin_id = a.id AND e.product = 'team_ledger') AS has_ledger,
              (SELECT count(*)::int FROM entitlements e
                WHERE e.admin_id = a.id AND e.product = 'tournament_credit') AS credits_total,
              (SELECT count(*)::int FROM entitlements e
                WHERE e.admin_id = a.id AND e.product = 'tournament_credit'
                  AND e.consumed_at IS NULL) AS credits_unused
         FROM admins a
         LEFT JOIN LATERAL (
           SELECT display_name FROM teams
            WHERE owner_admin_id = a.id ORDER BY created_at LIMIT 1
         ) t ON TRUE
        WHERE a.platform_role <> 'megaadmin' AND a.is_active
          -- A team's shared viewer login is not a customer: a purchase
          -- must never attach to it (migration 49).
          AND NOT EXISTS (SELECT 1 FROM team_memberships vm
                           WHERE vm.admin_id = a.id AND vm.team_role = 'viewer')
          AND ($1 = '' OR a.username ILIKE '%' || $1 || '%'
               OR a.name ILIKE '%' || $1 || '%'
               OR a.email ILIKE '%' || $1 || '%')
        ORDER BY a.username
        LIMIT 50`,
      [q],
    );

    return NextResponse.json({ success: true, data: res.rows });
  } catch (error) {
    return handleRouteError("[ops/accounts]", error);
  }
}
