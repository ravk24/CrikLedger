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
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "DB_UNREACHABLE", message: "SELECT 1 failed" },
      },
      { status: 500 },
    );
  }
}
