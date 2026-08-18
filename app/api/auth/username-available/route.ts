import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { handleRouteError, usernameAvailabilitySchema } from "@/lib/validate";

// Availability check for the signup form.
//
// POST rather than GET: the repo's route handlers all take JSON bodies,
// and reading nextUrl.searchParams makes the prerender pass log a
// bail-out (the `dynamic` segment config that would silence it is
// incompatible with nextConfig.cacheComponents). It also keeps probed
// user ids out of URL access logs.
//
// This endpoint IS a user-id enumeration oracle, unavoidably: the whole
// point is to answer "is this taken". The mitigation is rate limiting,
// which is Feature 7's scope — not hiding the answer, which would make
// signup unusable. It returns only a boolean: never a name, never a
// reason, never anything about the account that holds the id.
export async function POST(req: NextRequest) {
  try {
    const parsed = usernameAvailabilitySchema.safeParse(await req.json());
    // An invalid user id is simply unavailable — the form shows the same
    // "choose another" state and no schema detail leaks.
    if (!parsed.success) {
      return NextResponse.json({
        success: true,
        data: { available: false, valid: false },
      });
    }

    const res = await pool.query(`SELECT 1 FROM admins WHERE username = $1`, [
      parsed.data.username,
    ]);

    return NextResponse.json({
      success: true,
      data: { available: res.rowCount === 0, valid: true },
    });
  } catch (error) {
    return handleRouteError("[auth/username-available]", error);
  }
}
