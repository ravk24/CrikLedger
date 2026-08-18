import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AdminManager, type AdminListRow } from "@/components/admin/AdminManager";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionAdmin } from "@/lib/session";
import { pool } from "@/lib/db";

async function ManageData() {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangePassword) redirect("/admin/password");
  if (admin.role !== "superadmin") redirect("/admin");

  const res = await pool.query(
    `SELECT id, username, name, role, is_active, created_at
     FROM admins ORDER BY created_at ASC`,
  );
  const admins = res.rows as AdminListRow[];

  return <AdminManager admins={admins} selfId={admin.id} />;
}

export default function AdminManage() {
  return (
    <div className="min-h-svh bg-background pb-16">
      <header className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-md items-center justify-between px-2 py-3">
          <div className="flex items-center gap-1">
            <Link
              href="/admin"
              className="flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-text-secondary"
            >
              <ChevronLeft size={18} />
              Console
            </Link>
            <h1 className="text-xl font-semibold text-text-primary">Admins</h1>
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
