import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/cookies";
import { pool } from "@/lib/db";
import { ApiError } from "@/lib/validate";
import type { AdminRole } from "@/types";

export { SESSION_COOKIE };
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

type SessionPayload = {
  adminId: string;
  role: AdminRole;
};

export type SessionAdmin = {
  id: string;
  username: string;
  name: string;
  role: AdminRole;
  mustChangePassword: boolean;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret());
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.adminId !== "string") return null;
    const role = payload.role;
    if (role !== "admin" && role !== "superadmin") return null;
    return { adminId: payload.adminId, role };
  } catch {
    return null;
  }
}

// Fresh-row lookup on EVERY REQUEST — the is_active re-check is what
// makes revocation instant. React cache() dedupes only within a single
// request's render (page + layout share one admins query); outside a
// render (API routes) it is a pass-through. Never cache across
// requests (library-docs § jose).
const loadSessionAdmin = cache(async (): Promise<SessionAdmin | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const res = await pool.query(
    `SELECT id, username, name, role, must_change_password, is_active
     FROM admins WHERE id = $1`,
    [payload.adminId],
  );
  const row = res.rows[0];
  if (!row || !row.is_active) return null;

  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    mustChangePassword: row.must_change_password,
  };
});

type RequireOptions = {
  // change-password and /me must work while the forced change is pending
  allowPasswordChangePending?: boolean;
};

export async function requireAdmin(
  options: RequireOptions = {},
): Promise<SessionAdmin> {
  const admin = await loadSessionAdmin();
  if (!admin) {
    throw new ApiError(401, "UNAUTHORIZED", "Sign in required");
  }
  if (admin.mustChangePassword && !options.allowPasswordChangePending) {
    throw new ApiError(
      403,
      "PASSWORD_CHANGE_REQUIRED",
      "Set a new password before doing anything else",
    );
  }
  return admin;
}

export async function requireSuperadmin(): Promise<SessionAdmin> {
  const admin = await requireAdmin();
  if (admin.role !== "superadmin") {
    throw new ApiError(403, "FORBIDDEN", "Superadmin only");
  }
  return admin;
}

// Page-side variant: returns null instead of throwing Response-shaped
// errors, for server components that redirect on their own.
export async function getSessionAdmin(): Promise<SessionAdmin | null> {
  return loadSessionAdmin();
}
