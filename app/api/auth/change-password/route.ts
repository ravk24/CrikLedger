import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { changePasswordSchema, handleRouteError } from "@/lib/validate";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin({ allowPasswordChangePending: true });
    const { new_password } = changePasswordSchema.parse(await req.json());

    await pool.query(
      `UPDATE admins
       SET password_hash = crypt($1, gen_salt('bf')),
           must_change_password = FALSE
       WHERE id = $2`,
      [new_password, admin.id],
    );

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleRouteError("[auth/change-password]", error);
  }
}
