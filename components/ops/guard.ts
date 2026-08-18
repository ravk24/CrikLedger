import { notFound, redirect } from "next/navigation";
import { isMegaadmin } from "@/lib/roles";
import { getSessionAdmin, type SessionAdmin } from "@/lib/session";

// Page-side gate for /ops. Belt and braces with proxy.ts, which can only
// check that a cookie is signed — it cannot reach the database, so it
// cannot know who the holder is.
//
// notFound(), not a 403: a team superadmin who wanders in should not
// learn that an operator console exists.
export async function requireMegaadminPage(next: string): Promise<SessionAdmin> {
  const admin = await getSessionAdmin();
  if (!admin) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!isMegaadmin(admin)) notFound();
  return admin;
}
