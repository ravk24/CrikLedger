import { NextRequest, NextResponse } from "next/server";
import { requireTournamentWrite } from "@/lib/session";
import { handleRouteError, tournamentEntryEditSchema } from "@/lib/validate";
import { deleteEntry, editEntry } from "@/lib/tournaments";

// Editing a common debit re-splits across the CURRENT active roster
// (same rule as the pool common debit).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  try {
    const { id, entryId } = await params;
    const admin = await requireTournamentWrite(id);
    const body = tournamentEntryEditSchema.parse(await req.json());
    const result = await editEntry(admin.id, id, entryId, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/entries/edit]", error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  try {
    const { id, entryId } = await params;
    await requireTournamentWrite(id);
    const result = await deleteEntry(id, entryId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[tournaments/entries/delete]", error);
  }
}
