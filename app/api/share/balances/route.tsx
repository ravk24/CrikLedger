import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { handleRouteError } from "@/lib/validate";
import { requireTeamAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import { getTeamById } from "@/lib/team";
import {
  ShareFrame,
  SHARE_WIDTH,
  balanceRupees,
  moneyColor,
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
    const { data } = await supabaseServer
      .from("players_public")
      .select("*")
      .eq("team_id", team.id);
    const players = ((data ?? []) as PlayerPublic[])
      // Same order as the Home dashboard: active first, biggest debtors
      // on top, names only break ties.
      .sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        if (Number(a.balance) !== Number(b.balance))
          return Number(a.balance) - Number(b.balance);
        return a.name.localeCompare(b.name);
      })
      .slice(0, MAX_ROWS);

    const twoColumns = players.length > 15;
    const half = twoColumns ? Math.ceil(players.length / 2) : players.length;
    const columns = twoColumns
      ? [players.slice(0, half), players.slice(half)]
      : [players];
    const height = Math.min(2200, Math.max(900, 420 + Math.max(half, 1) * 60));
    const activeCount = players.filter((p) => p.is_active).length;

    return new ImageResponse(
      (
        <ShareFrame
          title={`${team.display_name} · Balances`}
          subtitle={`${activeCount} active players · ${shareDate()}`}
          footer="Negative = amount owed to the team pool"
        >
          <div style={{ display: "flex", gap: 40, marginTop: 32 }}>
            {players.length === 0 ? (
              <div style={{ display: "flex", fontSize: 28, color: "#94a3b8" }}>
                No players yet.
              </div>
            ) : null}
            {columns.map((col, ci) => (
              <div key={ci} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                {col.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      fontSize: twoColumns ? 24 : 28,
                      padding: "12px 0",
                      borderBottom: "1px solid #1e293b",
                      color: p.is_active ? "#e2e8f0" : "#64748b",
                    }}
                  >
                    <div style={{ display: "flex", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {p.name.slice(0, 28)}
                      {p.is_active ? "" : " · Left"}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexShrink: 0,
                        fontWeight: 700,
                        color: p.is_active ? moneyColor(Number(p.balance)) : "#64748b",
                      }}
                    >
                      {balanceRupees(Number(p.balance))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </ShareFrame>
      ),
      {
        width: SHARE_WIDTH,
        height,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (e) {
    return handleRouteError("[share/balances]", e);
  }
}
