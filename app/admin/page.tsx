import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  Home,
  KeyRound,
  MinusCircle,
  PlusCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { ScheduleMatchTile } from "@/components/admin/ScheduleMatchTile";
import { CaptainTile } from "@/components/admin/CaptainTile";
import { ViceCaptainTile } from "@/components/admin/ViceCaptainTile";
import { Money } from "@/components/shared/Money";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/format";
import { getSessionAdmin } from "@/lib/session";
import { supabasePublic } from "@/lib/supabase-public";
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
];

// Rendered after Schedule match, so it stays last for every role.
const PASSWORD_TILE: Tile = {
  label: "Change password",
  href: "/admin/password",
  icon: KeyRound,
  iconClass: "bg-inactive-light text-inactive-foreground",
};

async function ConsoleData() {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangePassword) redirect("/admin/password");

  const isSuperadmin = admin.activeTeamRole === "superadmin";
  const team = await getCurrentTeam();
  const [poolRes, lastEntryRes, playersRes] = await Promise.all([
    supabasePublic
      .from("pool_balance")
      .select("balance")
      .eq("team_id", team.id)
      .single(),
    supabasePublic
      .from("pool_ledger_public")
      .select("entry_date, edited_by")
      .eq("team_id", team.id)
      .limit(1)
      .maybeSingle(),
    isSuperadmin
      ? supabasePublic
          .from("players_public")
          .select("id, name, is_captain, is_vice_captain")
          .eq("team_id", team.id)
          .eq("is_active", true)
          .order("name")
      : Promise.resolve({ data: null }),
  ]);
  const captainPlayers = (playersRes.data ?? []) as {
    id: string;
    name: string;
    is_captain: boolean;
    is_vice_captain: boolean;
  }[];
  const poolBalance = Number(poolRes.data?.balance ?? 0);
  const lastEntry = lastEntryRes.data as {
    entry_date: string;
    edited_by: string | null;
  } | null;

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
        className="flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface p-4 text-text-primary"
      >
        {inner}
      </Link>
    ) : (
      <div
        key={tile.label}
        className="flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface p-4 text-text-muted opacity-70"
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
          className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text-secondary"
        >
          <Home size={18} />
        </Link>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-lg font-bold text-text-primary">
            Hello, {admin.name}
          </h1>
          <p className="text-xs capitalize text-text-secondary">
            {admin.activeTeamRole ?? admin.platformRole}
          </p>
        </div>
        <LogoutButton />
      </div>

      <section className="grid grid-cols-2 gap-3">
        {isSuperadmin && <CaptainTile players={captainPlayers} />}
        {isSuperadmin && <ViceCaptainTile players={captainPlayers} />}
        {tiles.map(renderTile)}
        <ScheduleMatchTile />
        {renderTile(PASSWORD_TILE)}
      </section>

      <section className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
        <div>
          <p className="text-sm text-text-secondary">
            Pool balance{" "}
            <Money
              amount={poolBalance}
              variant="balance"
              className="font-semibold"
            />
          </p>
          {lastEntry && (
            <p className="text-xs text-text-muted">
              Last entry {formatDateShort(lastEntry.entry_date)}
              {lastEntry.edited_by && ` · ${lastEntry.edited_by}`}
            </p>
          )}
        </div>
        <Link href="/pool" className="text-sm font-medium text-accent">
          Open ledger
        </Link>
      </section>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-text-muted">
        <Image src="/logo.png" alt="" width={16} height={16} />
        CricLedger · v0.1
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
