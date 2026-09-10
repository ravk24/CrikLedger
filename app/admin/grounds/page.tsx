import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { GroundManager } from "@/components/admin/GroundManager";
import { Skeleton } from "@/components/ui/skeleton";
import { pool } from "@/lib/db";
import type { TeamGround } from "@/lib/grounds";
import { getSessionAdmin } from "@/lib/session";
import { CHROME_HEADER, CHROME_BACK_LINK } from "@/lib/ui";

// Ground presets (migration 51). Superadmin only, like /admin/manage:
// the list decides what every admin sees in the scheduling dropdown.
async function GroundsData() {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/login");
  if (admin.mustChangePassword) redirect("/admin/password");
  if (admin.activeTeamRole !== "superadmin" || !admin.activeTeamId) {
    redirect("/admin");
  }

  const res = await pool.query<TeamGround>(
    `SELECT id, name, car_allowance::int AS car_allowance, is_active
       FROM team_grounds
      WHERE team_id = $1
      ORDER BY is_active DESC, name ASC`,
    [admin.activeTeamId],
  );
  const grounds = res.rows.map((g) => ({
    ...g,
    car_allowance: Number(g.car_allowance),
  }));
  const activeCount = grounds.filter((g) => g.is_active).length;

  return (
    <>
      <p className="text-sm text-text-secondary">
        {activeCount} in the dropdown · {grounds.length - activeCount} hidden
      </p>
      <GroundManager grounds={grounds} />
    </>
  );
}

export default function AdminGrounds() {
  return (
    <div className="min-h-svh bg-background pb-16">
      <header className={CHROME_HEADER}>
        <div className="mx-auto flex max-w-md items-center gap-1 px-2 py-3">
          <Link href="/admin" className={CHROME_BACK_LINK}>
            <ChevronLeft size={18} />
            Console
          </Link>
          <h1 className="text-xl font-semibold text-chrome-foreground">
            Grounds &amp; car fee
          </h1>
          <span className="ml-auto rounded-full bg-accent-light px-2 py-0.5 text-[11px] font-semibold text-accent">
            Superadmin only
          </span>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
          <GroundsData />
        </Suspense>
      </main>
    </div>
  );
}
