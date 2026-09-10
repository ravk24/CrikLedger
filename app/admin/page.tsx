import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  Home,
  KeyRound,
  MapPin,
  MinusCircle,
  PlusCircle,
  DatabaseBackup,
  ShieldCheck,
  Users,
} from "lucide-react";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { CaptainTile } from "@/components/admin/CaptainTile";
import { ViceCaptainTile } from "@/components/admin/ViceCaptainTile";
import { PrivilegesCard } from "@/components/admin/PrivilegesCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { pool } from "@/lib/db";
import { tournamentCreditsLeft } from "@/lib/entitlements";
import { canWrite } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import { getCurrentTeam } from "@/lib/team";

type Tile = {
  label: string;
  href: string | null; // null = not built yet, renders disabled
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  superadminOnly?: boolean;
};

const TILES: Tile[] = [
  {
    label: "Pool credit",
    href: "/pool",
    icon: PlusCircle,
    iconClass: "bg-credit-light text-credit-foreground",
  },
  {
    label: "Pool debit",
    href: "/pool",
    icon: MinusCircle,
    iconClass: "bg-debit-light text-debit-foreground",
  },
  {
    label: "Manage players",
    href: "/admin/players",
    icon: Users,
    iconClass: "bg-scheduled-light text-scheduled-foreground",
  },
  {
    label: "Manage admins",
    href: "/admin/manage",
    icon: ShieldCheck,
    iconClass: "bg-accent-light text-accent",
    superadminOnly: true,
  },
  {
    label: "Grounds & car fee",
    href: "/admin/grounds",
    icon: MapPin,
    iconClass: "bg-low-light text-low-foreground",
    superadminOnly: true,
  },
];

// Rendered last for every role.
const PASSWORD_TILE: Tile = {
  label: "Change password",
  href: "/admin/password",
  icon: KeyRound,
  iconClass: "bg-inactive-light text-inactive-foreground",
};

async function ConsoleData() {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/login");
  if (admin.mustChangePassword) redirect("/admin/password");
  // proxy.ts only proves a signed token. A session that cannot write
  // this team — the shared viewer login, the megaadmin observer — has
  // no business on the console; every tile here is a write.
  if (!canWrite(admin, "team", admin.activeTeamId)) redirect("/");

  const isSuperadmin = admin.activeTeamRole === "superadmin";
  const team = await getCurrentTeam();
  const [playersRes, superRes] = await Promise.all([
    isSuperadmin
      ? supabaseServer
          .from("players_public")
          .select("id, name, is_captain, is_vice_captain")
          .eq("team_id", team.id)
          .eq("is_active", true)
          .order("name")
      : Promise.resolve({ data: null }),
    // Two team-scoped scalars in one statement (they used to be two
    // queries on two pooled connections). phone is deliberately absent
    // from players_public (migration 43), so the captain's number comes
    // straight off the base table.
    isSuperadmin
      ? pool.query<{ n: string; phone: string | null }>(
          `SELECT
             (SELECT count(*) FROM team_memberships
               WHERE team_id = $1 AND team_role = 'admin' AND is_active) AS n,
             (SELECT phone FROM players
               WHERE team_id = $1 AND is_captain LIMIT 1) AS phone`,
          [team.id],
        )
      : Promise.resolve({ rows: [{ n: "0", phone: null as string | null }] }),
  ]);
  const adminCount = Number(superRes.rows[0]?.n ?? 0);
  const captainPhone = superRes.rows[0]?.phone ?? null;
  const captainPlayers = (playersRes.data ?? []) as {
    id: string;
    name: string;
    is_captain: boolean;
    is_vice_captain: boolean;
  }[];

  const tiles = TILES.filter(
    (t) => !t.superadminOnly || isSuperadmin,
  );

  function renderTile(tile: Tile) {
    const Icon = tile.icon;
    const inner = (
      <>
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-md",
            tile.iconClass,
          )}
        >
          <Icon size={18} />
        </span>
        <span className="text-sm font-semibold">{tile.label}</span>
        {!tile.href && (
          <span className="text-[11px] text-text-muted">Coming next</span>
        )}
      </>
    );
    return tile.href ? (
      <Link
        key={tile.label}
        href={tile.href}
        className="flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface shadow-card p-4 text-text-primary"
      >
        {inner}
      </Link>
    ) : (
      <div
        key={tile.label}
        className="flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface shadow-card p-4 text-text-muted opacity-70"
      >
        {inner}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/"
          aria-label="Home"
          className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface shadow-card text-text-secondary"
        >
          <Home size={18} />
        </Link>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-lg font-bold text-text-primary">
            {admin.name.split(" ")[0]}
          </h1>
          <p className="text-xs capitalize text-text-secondary">
            {admin.activeTeamRole ?? admin.platformRole}
          </p>
        </div>
        <LogoutButton />
      </div>

      {isSuperadmin && (
        <PrivilegesCard
          name={admin.name.split(" ")[0]}
          teamName={team.display_name}
          adminCount={adminCount}
          creditsLeft={tournamentCreditsLeft(admin)}
        />
      )}

      <section className="grid grid-cols-2 gap-3">
        {isSuperadmin && (
          <CaptainTile players={captainPlayers} captainPhone={captainPhone} />
        )}
        {isSuperadmin && <ViceCaptainTile players={captainPlayers} />}
        {tiles.map(renderTile)}
        {renderTile(PASSWORD_TILE)}
      </section>

      <p className="text-center text-xs text-text-muted">
        <DatabaseBackup size={18} className="mr-1.5 inline-block align-text-bottom" />
        Your data is protected — database backed up every 5th day, passwords
        are hashed.
      </p>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-text-muted">
        <Image src="/logo.png" alt="" width={16} height={16} />
        CrikLedger · v1.1
      </p>
    </>
  );
}

export default function AdminConsole() {
  return (
    <div className="min-h-svh bg-background pb-16">
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6">
        <Suspense
          fallback={
            <>
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-64 rounded-lg" />
            </>
          }
        >
          <ConsoleData />
        </Suspense>
      </main>
    </div>
  );
}
