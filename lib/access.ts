import { canRead } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";

// Page-level read/write verdicts, for server components that render an
// AccessGate panel instead of throwing.
//
// API routes do NOT use this — they use the guards in lib/session.ts,
// which throw Response-shaped errors. This is purely about what a page
// should show, and it is deliberately NOT the security boundary: the
// boundary is the write guards plus (since migration 33) the fact that
// no data is reachable without the service role.

export type Verdict =
  | { ok: true; teamId: string; via: "member" | "megaadmin" }
  | { ok: false; reason: "anonymous" | "forbidden" | "no-team" };

export async function checkTeamRead(
  teamId: string | null,
): Promise<Verdict> {
  const admin = await getSessionAdmin();
  if (!admin) return { ok: false, reason: "anonymous" };
  if (!teamId) return { ok: false, reason: "no-team" };
  if (!canRead(admin, "team", teamId)) return { ok: false, reason: "forbidden" };
  return {
    ok: true,
    teamId,
    via: admin.platformRole === "megaadmin" ? "megaadmin" : "member",
  };
}

/** The team the request is acting on, from the cl_team cookie. */
export async function checkActiveTeamRead(): Promise<Verdict> {
  const admin = await getSessionAdmin();
  if (!admin) return { ok: false, reason: "anonymous" };
  return checkTeamRead(admin.activeTeamId);
}
