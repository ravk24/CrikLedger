import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { generateTempPassword } from "@/lib/password";
import { requireSuperadmin } from "@/lib/session";
import { ApiError, createAdminSchema, handleRouteError } from "@/lib/validate";

export async function GET() {
  try {
    await requireSuperadmin();
    const res = await pool.query(
      `SELECT id, username, name, role, is_active, created_at
       FROM admins ORDER BY created_at ASC`,
    );
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error) {
    return handleRouteError("[sa/admins]", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const superadmin = await requireSuperadmin();
    const { username, name } = createAdminSchema.parse(await req.json());

    const taken = await pool.query(`SELECT 1 FROM admins WHERE username = $1`, [
      username,
    ]);
    if ((taken.rowCount ?? 0) > 0) {
      throw new ApiError(409, "USERNAME_TAKEN", "That username is taken");
    }

    // Shown ONCE in the response — never stored or logged in plaintext.
    const tempPassword = generateTempPassword();
    const res = await pool.query(
      `INSERT INTO admins (username, name, password_hash, role, must_change_password, created_by)
       VALUES ($1, $2, crypt($3, gen_salt('bf')), 'admin', TRUE, $4)
       RETURNING id, username, name`,
      [username, name, tempPassword, superadmin.id],
    );

    return NextResponse.json(
      { success: true, data: { ...res.rows[0], temp_password: tempPassword } },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError("[sa/admins]", error);
  }
}
