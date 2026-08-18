import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
  requireAccount,
  setSessionCookie,
  signSession,
} from "@/lib/session";
import {
  ApiError,
  changePasswordSchema,
  handleRouteError,
} from "@/lib/validate";

export async function POST(req: NextRequest) {
  try {
    // requireAccount, not requireTeamAdmin: an account with no team must
    // still be able to change its password.
    const admin = await requireAccount({ allowPasswordChangePending: true });
    const { current_password, new_password } = changePasswordSchema.parse(
      await req.json(),
    );

    // A voluntary change proves the old password. The forced first-login
    // change cannot — the temp password was just used to get here, and
    // must_change_password is the server's own flag, not client input.
    if (!admin.mustChangePassword) {
      if (!current_password) {
        throw new ApiError(
          422,
          "CURRENT_PASSWORD_REQUIRED",
          "Enter your current password",
        );
      }
      const check = await pool.query(
        `SELECT 1 FROM admins
          WHERE id = $1 AND password_hash = crypt($2, password_hash)`,
        [admin.id, current_password],
      );
      if (check.rowCount === 0) {
        throw new ApiError(
          403,
          "INVALID_CURRENT_PASSWORD",
          "That is not your current password",
        );
      }
    }

    // Bumping the epoch signs out every other device holding a token.
    const res = await pool.query<{ session_epoch: number }>(
      `UPDATE admins
          SET password_hash = crypt($1, gen_salt('bf')),
              must_change_password = FALSE,
              session_epoch = session_epoch + 1
        WHERE id = $2
      RETURNING session_epoch`,
      [new_password, admin.id],
    );

    // Re-issue THIS session's cookie with the new epoch. Without it the
    // user signs themselves out the instant they change their password.
    const token = await signSession({
      adminId: admin.id,
      epoch: res.rows[0].session_epoch,
    });
    await setSessionCookie(token);

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return handleRouteError("[auth/change-password]", error);
  }
}
