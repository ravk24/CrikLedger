import { ImageResponse } from "next/og";
import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRouteError } from "@/lib/validate";
import { canWrite } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import {
  BalanceRows,
  ShareFrame,
  SHARE_WIDTH,
  balanceImageHeight,
  shareDate,
} from "@/lib/share-image";
import type { TournamentPlayerPublic, TournamentPublic } from "@/types";

const MAX_ROWS = 60;
const querySchema = z.object({ id: z.string().uuid() });

// A tournament roster's balances as a PNG — the tournament analogue of
// /api/share/balances. Gated like the tournament Home tab: a writer of
// the hosting team, or of the tournament itself when standalone.
export async function GET(req: NextRequest) {
  await connection();
  try {
    const { id } = querySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    const admin = await getSessionAdmin();
    if (!admin || admin.mustChangePassword) {
      throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue");
    }
    const tRes = await supabaseServer
      .from("tournaments_public")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const tournament = tRes.data as TournamentPublic | null;
    if (!tournament) {
      throw new ApiError(404, "NOT_FOUND", "Tournament not found");
    }
    const allowed = tournament.team_id
      ? canWrite(admin, "team", tournament.team_id)
      : canWrite(admin, "tournament", tournament.id);
    if (!allowed) {
      throw new ApiError(403, "SCOPE_FORBIDDEN", "Admins of this tournament only");
    }

    const { data } = await supabaseServer
      .from("tournament_players_public")
      .select("*")
      .eq("tournament_id", id)
      .order("is_active", { ascending: false })
      .order("balance", { ascending: true })
      .order("name", { ascending: true })
      .limit(MAX_ROWS);
    // Same order as the tournament Home tab.
    const players = ((data ?? []) as TournamentPlayerPublic[])
      .sort(
        (a, b) =>
          Number(a.is_active === false) - Number(b.is_active === false) ||
          Number(a.balance) - Number(b.balance) ||
          a.name.localeCompare(b.name),
      )
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
          title={`${tournament.name} · Balances`}
          subtitle={`${activeCount} active players · ${shareDate()}`}
          footer="Negative = amount owed to the tournament fund"
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
    return handleRouteError("[share/tournament-balances]", e);
  }
}
