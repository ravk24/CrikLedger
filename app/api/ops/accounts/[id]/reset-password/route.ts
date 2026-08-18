import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { generateTempPassword } from "@/lib/password";
import { requireMegaadmin } from "@/lib/session";
import { ApiError, handleRouteError } from "@/lib/validate";

// Platform-level password reset. This is the account recovery channel
// while there is no password-reset email (signup stores the address but
// nothing sends to it).
//
// An ACCOUNT action, not a scope write — the megaadmin still cannot
// touch any team's data.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireMegaadmin();
    const { id } = await params;

    const tempPassword = generateTempPassword();
    const res = await pool.query(
      `UPDATE admins
          SET password_hash = crypt($2, gen_salt('bf')),
              must_change_password = TRUE,
              session_epoch = session_epoch + 1
        WHERE id = $1
      RETURNING id, username`,
      [id, tempPassword],
    );
    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Account not found");
    }

    // Returned exactly once — never stored or logged in plaintext.
    return NextResponse.json({
      success: true,
      data: { ...res.rows[0], temp_password: tempPassword },
    });
  } catch (error) {
    return handleRouteError("[ops/reset-password]", error);
  }
}
