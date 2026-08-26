import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireTournamentWrite } from "@/lib/session";
import {
  ApiError,
  editTournamentSchema,
  handleRouteError,
} from "@/lib/validate";
import { deleteTournament, updateTournament } from "@/lib/tournaments";

// Edit details, Complete (status: 'completed') or Reopen ('active').
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = await requireTournamentWrite(id);
    const body = editTournamentSchema.parse(await req.json());
    // The joining fee drives the whole settlement, so only a superadmin
    // may change it after creation; everything else stays admin-editable.
    if (body.joining_fee !== undefined && admin.scopeRole !== "superadmin") {
      throw new ApiError(
        403,
        "SCOPE_FORBIDDEN",
        "Only a superadmin can change the joining fee",
      );
    }
    const result = await updateTournament(admin.id, id, body);
    // The public directory (name + status) is cached — see app/(app)/tournaments.
    revalidateTag("tournament-directory", "max");
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/edit]", error);
  }
}

// Cascade-deletes the roster, ledger and shares in one transaction.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireTournamentWrite(id, { superadmin: true });
    const result = await deleteTournament(id);
    revalidateTag("tournament-directory", "max");
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/delete]", error);
  }
}
