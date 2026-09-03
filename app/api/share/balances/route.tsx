import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { handleRouteError } from "@/lib/validate";
import { requireTeamAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import { getTeamById } from "@/lib/team";
import {
  BalanceRows,
  ShareFrame,
  SHARE_WIDTH,
  balanceImageHeight,
  shareDate,
} from "@/lib/share-image";
import type { PlayerPublic } from "@/types";

const MAX_ROWS = 60;

// Every player's current balance as a PNG — the "who owes what" picture
// an admin posts after a match. Admin-only; reads the DB itself.
export async function GET() {
  // Per-request by nature (session cookie); this keeps the build's
  // prerender pass from reaching the try/catch below.
  await connection();
  try {
    const admin = await requireTeamAdmin();
    const team = await getTeamById(admin.scopeId);
    const [playersRes, balanceRes] = await Promise.all([
      supabaseServer
        .from("players_public")
        .select("*")
        .eq("team_id", team.id)
        // Same order the JS sort below applies; the DB limit keeps the
        // fetch bounded to what the image can show.
        .order("is_active", { ascending: false })
        .order("balance", { ascending: true })
        .order("name", { ascending: true })
        .limit(MAX_ROWS),
      supabaseServer
        .from("pool_balance")
        .select("balance")
        .eq("team_id", team.id)
        .single(),
    ]);
    const balance = Number(balanceRes.data?.balance ?? 0);
    const players = ((playersRes.data ?? []) as PlayerPublic[])
      // Same order as the Home dashboard: active first, biggest debtors
      // on top, names only break ties.
      .sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        if (Number(a.balance) !== Number(b.balance))
          return Number(a.balance) - Number(b.balance);
        return a.name.localeCompare(b.name);
      })
      .slice(0, MAX_ROWS);

    const activeCount = players.filter((p) => p.is_active).length;
    const rows = players.map((p) => ({
      id: p.id,
      name: p.name,
      is_active: p.is_active,
      balance: Number(p.balance),
    }));

    return new ImageResponse(
      (
        <ShareFrame
          title={`${team.display_name} · Balances`}
          subtitle={`${activeCount} active players · ${shareDate()}`}
          highlight={{ label: "Team pool", amount: balance }}
          footer="Negative = amount owed to the team pool"
        >
          <BalanceRows players={rows} />
        </ShareFrame>
      ),
      {
        width: SHARE_WIDTH,
        height: balanceImageHeight(rows.length),
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (e) {
    return handleRouteError("[share/balances]", e);
  }
}
