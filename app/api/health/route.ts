import { NextRequest, NextResponse } from "next/server";

// "Is this deployment wired up?" — one curl, for an operator.
//
// Written after a production sign-in failed with a generic 500 while every
// public page looked healthy: the pages are prerendered and read Supabase
// over HTTPS, so only the paths that open a Postgres socket were broken,
// and nothing said so. This answers the question those paths could not.
//
// It reports PRESENCE ONLY — never a value, never a length, nothing that
// narrows a secret. Behind the same CRON_SECRET bearer check
// app/api/cron/keepalive/route.ts uses, because even the shape of a
// deployment's configuration is not public.
const REQUIRED_ENV = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "CRON_SECRET",
] as const;

// The two modules under test throw at import when their variable is
// missing, which is the point of them — so they are imported HERE, inside
// the check, rather than at the top of the file. A static import would
// take this route down with them and leave the operator with the same
// blank 500 that prompted it.
async function probe(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "ok";
  } catch (e) {
    // The message names the host or the variable; the stack does not, and
    // is noise in a status payload.
    return (e as Error)?.message?.slice(0, 200) ?? "failed";
  }
}

export async function GET(req: NextRequest) {
  if (
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Bad token" } },
      { status: 401 },
    );
  }

  const env = Object.fromEntries(
    REQUIRED_ENV.map((name) => [name, Boolean(process.env[name])]),
  );

  const db = await probe(async () => {
    const { pool } = await import("@/lib/db");
    await pool.query("SELECT 1");
  });

  // Exercises the exact call sign-in makes. A throwaway payload, never
  // written to a cookie, so this mints nothing and grants nothing.
  const sign = await probe(async () => {
    const { signSession } = await import("@/lib/session");
    await signSession({ adminId: "health-probe", epoch: 0 });
  });

  const ok = Object.values(env).every(Boolean) && db === "ok" && sign === "ok";

  return NextResponse.json(
    {
      success: true,
      data: {
        ok,
        target: process.env.VERCEL_ENV ?? "local",
        region: process.env.VERCEL_REGION ?? null,
        env,
        db,
        sign,
      },
    },
    { status: ok ? 200 : 503 },
  );
}
