import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { handleRouteError } from "@/lib/validate";
import { requireTeamAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import { getTeamById } from "@/lib/team";
import { formatDateShort } from "@/lib/format";
import { ledgerRowTitle } from "@/lib/poolKinds";
import {
  ShareFrame,
  SHARE_WIDTH,
  moneyColor,
  shareDate,
  signedRupees,
} from "@/lib/share-image";
import type { PoolLedgerRow } from "@/types";

const LIMIT = 20;

// Row titles come from lib/poolKinds ledgerRowTitle — the same rule
// components/shared/LedgerRow uses, so the image matches the page.

// The team ledger's newest 20 entries as a PNG, for an admin to drop in
// the team group. Reads the DB itself — nothing about the rows comes
// from the client — and is admin-only because a ledger is team-private.
export async function GET() {
  // Per-request by nature (session cookie); this keeps the build's
  // prerender pass from reaching the try/catch below.
  await connection();
  try {
    const admin = await requireTeamAdmin();
    const team = await getTeamById(admin.scopeId);
    const [entriesRes, balanceRes] = await Promise.all([
      supabaseServer
        .from("pool_ledger_public")
        .select("*")
        .eq("team_id", team.id)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabaseServer
        .from("pool_balance")
        .select("balance")
        .eq("team_id", team.id)
        .single(),
    ]);
    const entries = (entriesRes.data ?? []) as PoolLedgerRow[];
    const balance = Number(balanceRes.data?.balance ?? 0);

    // 720-space (lib/share-image.tsx): the old 1080 formula × ⅔, plus
    // ~50 px for the pool-balance pill under the title.
    const height = Math.max(600, 330 + Math.max(entries.length, 1) * 43);

    return new ImageResponse(
      (
        <ShareFrame
          title={`${team.display_name} · Ledger`}
          subtitle={`Last ${entries.length} entries · ${shareDate()}`}
          highlight={{ label: "Pool balance", amount: balance }}
        >
          <div style={{ display: "flex", flexDirection: "column", marginTop: 21 }}>
            {entries.length === 0 ? (
              <div style={{ display: "flex", fontSize: 19, color: "#94a3b8" }}>
                The ledger is empty.
              </div>
            ) : null}
            {entries.map((e) => (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  fontSize: 17,
                  padding: "9px 0",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                <div style={{ display: "flex", width: 80, flexShrink: 0, color: "#94a3b8" }}>
                  {formatDateShort(e.entry_date)}
                </div>
                <div
                  style={{
                    display: "flex",
                    flex: 1,
                    color: "#e2e8f0",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ledgerRowTitle(e).slice(0, 48)}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexShrink: 0,
                    fontWeight: 700,
                    color: moneyColor(Number(e.amount)),
                  }}
                >
                  {signedRupees(Number(e.amount))}
                </div>
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
    return handleRouteError("[share/ledger]", e);
  }
}
