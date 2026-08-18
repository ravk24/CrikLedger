import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { signSession, setSessionCookie } from "@/lib/session";
import { ApiError, handleRouteError, loginSchema } from "@/lib/validate";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = loginSchema.parse(await req.json());

    // Password verification happens in SQL via pgcrypto. One generic
    // error for wrong username vs wrong password — never reveal which.
    const res = await pool.query(
      `SELECT id, name, role, must_change_password, is_active
       FROM admins
       WHERE username = $1 AND password_hash = crypt($2, password_hash)`,
      [username, password],
    );
    const row = res.rows[0];
    if (!row) {
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid username or password",
      );
    }
    if (!row.is_active) {
      throw new ApiError(403, "ADMIN_REVOKED", "This admin has been revoked");
    }

    const token = await signSession({ adminId: row.id, role: row.role });
    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      data: {
        admin_id: row.id,
        name: row.name,
        role: row.role,
        force_change: row.must_change_password,
      },
    });
  } catch (error) {
    return handleRouteError("[auth/login]", error);
  }
}
