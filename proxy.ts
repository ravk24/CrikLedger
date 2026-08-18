import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "cl_session";

// Page-level gate only: keeps signed-out visitors off /admin/* screens.
// API routes authorize themselves via requireAdmin()/requireSuperadmin(),
// which also re-check is_active — this guard never touches the database.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
      await jwtVerify(token, secret);
      return NextResponse.next();
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
