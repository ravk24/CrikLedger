import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AdminManager, type AdminListRow } from "@/components/admin/AdminManager";
import { ViewerManager, type ViewerRow } from "@/components/admin/ViewerManager";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionAdmin } from "@/lib/session";
import { pool } from "@/lib/db";
import { CHROME_HEADER, CHROME_BACK_LINK } from "@/lib/ui";

async function ManageData() {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/login");
  if (admin.mustChangePassword) redirect("/admin/password");
  // Superadmin OF THE ACTIVE TEAM — not an account-level role any more.
  if (admin.activeTeamRole !== "superadmin" || !admin.activeTeamId) {
    redirect("/admin");
  }

  // Scoped to the active team: listing every admin on the platform was a
  // cross-tenant leak the moment a second team existed. The viewer row
  // is a membership too but has its own card, so it stays out of the
  // admin list (and out of AdminListRow's role type).
  const [res, viewerRes] = await Promise.all([
    pool.query(
      `SELECT a.id, a.username, a.name, m.team_role AS role,
              m.is_active, m.created_at
         FROM team_memberships m
         JOIN admins a ON a.id = m.admin_id
        WHERE m.team_id = $1 AND m.team_role <> 'viewer'
        ORDER BY m.created_at ASC`,
      [admin.activeTeamId],
    ),
    pool.query<ViewerRow>(
      `SELECT a.username, m.created_at::text AS created_at,
              a.viewer_session_started_at::text AS in_use_since
         FROM team_memberships m
         JOIN admins a ON a.id = m.admin_id
        WHERE m.team_id = $1 AND m.team_role = 'viewer' AND m.is_active`,
      [admin.activeTeamId],
    ),
  ]);
  const admins = res.rows as AdminListRow[];

  return (
    <>
      <AdminManager admins={admins} selfId={admin.id} />
      <ViewerManager viewer={viewerRes.rows[0] ?? null} />
    </>
  );
}

export default function AdminManage() {
  return (
    <div className="min-h-svh bg-background pb-16">
      <header className={CHROME_HEADER}>
        <div className="mx-auto flex max-w-md items-center justify-between px-2 py-3">
          <div className="flex items-center gap-1">
            <Link
              href="/admin"
              className={CHROME_BACK_LINK}
            >
              <ChevronLeft size={18} />
              Console
            </Link>
            <h1 className="text-xl font-semibold text-chrome-foreground">Admins</h1>
          </div>
          <span className="mr-2 rounded-full bg-accent-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
            Superadmin only
          </span>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
          <ManageData />
        </Suspense>
      </main>
    </div>
  );
}
