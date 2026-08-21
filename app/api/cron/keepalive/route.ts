import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Daily Vercel cron — guards against the Supabase free-tier 7-day pause.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Bad token" } },
      { status: 401 },
    );
  }
  try {
    await pool.query("SELECT 1");
    return NextResponse.json({ success: true, data: { alive: true } });
  } catch (error) {
    // Logged, not swallowed: this cron is the only thing that touches the
    // database on a quiet day, so a silent catch here means production can
    // be unable to reach Postgres for as long as nobody tries to sign in.
    console.error("[cron/keepalive]", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "DB_UNREACHABLE", message: "SELECT 1 failed" },
      },
      { status: 500 },
    );
  }
}
