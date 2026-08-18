import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { setSessionCookie, signSession } from "@/lib/session";
import { ApiError, handleRouteError, signupSchema } from "@/lib/validate";

// Self-serve signup. The account starts with NO memberships and no
// powers: it can browse, and that is all. Purchases grant scopes
// (Feature 5), which is what makes someone a superadmin of a team or a
// tournament — there is deliberately no way to self-assign a role here.
export async function POST(req: NextRequest) {
  try {
    const { username, password, email, name } = signupSchema.parse(
      await req.json(),
    );

    let row: { id: string; session_epoch: number };
    try {
      const res = await pool.query<{ id: string; session_epoch: number }>(
        `INSERT INTO admins
           (username, name, password_hash, email, platform_role, must_change_password)
         VALUES ($1, $2, crypt($3, gen_salt('bf')), $4, 'user', FALSE)
         RETURNING id, session_epoch`,
        [username, name ?? username, password, email],
      );
      row = res.rows[0];
    } catch (err) {
      // Unique violations are the expected failure here; map them to the
      // contractual codes rather than leaking a 500.
      const code = (err as { code?: string }).code;
      const constraint = (err as { constraint?: string }).constraint;
      if (code === "23505") {
        throw constraint === "admins_email_lower_key"
          ? new ApiError(409, "EMAIL_TAKEN", "That email is already registered")
          : new ApiError(409, "USERNAME_TAKEN", "That user id is taken");
      }
      throw err;
    }

    const token = await signSession({
      adminId: row.id,
      epoch: row.session_epoch,
    });
    await setSessionCookie(token);
    // No cl_team cookie: a fresh account belongs to no team yet.

    return NextResponse.json({
      success: true,
      data: { admin_id: row.id, username },
    });
  } catch (error) {
    return handleRouteError("[auth/signup]", error);
  }
}
