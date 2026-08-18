import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/cookies";

// Page-level gate only: keeps signed-out visitors off /admin/* screens.
//
// This is a DOOR, NOT THE AUTHORITY. It runs in the middleware bundle and
// must never touch the database (importing lib/session.ts would pull pg
// in), so it cannot check is_active, session_epoch, or membership. It
// therefore proves only "this cookie was signed by us and is not
// expired". Every gated page and API route re-authorizes for itself via
// requireAccount()/requireTeamAdmin()/getSessionAdmin(), which re-read
// the account row on every request — that is where revocation, epoch
// invalidation and team membership are actually enforced.
//
// cl_team is passed through untouched: validating it needs memberships,
// i.e. the database.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
      const { payload } = await jwtVerify(token, secret);
      // Pre-migration-32 tokens carry `role` and no `epoch`. They can no
      // longer authorize anything, so bounce them to a fresh sign-in
      // here rather than letting them fail deeper in the page.
      if (typeof payload.epoch === "number") {
        return NextResponse.next();
      }
    } catch {
      // fall through to redirect — expired or tampered token
    }
  }

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
