import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, Swords } from "lucide-react";
import { GuestMatchFlow } from "@/components/guest/GuestMatchFlow";
import { ScheduleMatch } from "@/components/schedule/ScheduleMatch";
import { Skeleton } from "@/components/ui/skeleton";
import { getNavState } from "@/lib/nav";
import { getSessionAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

type Option = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
};

// The two cards that navigate. Scheduling is the third and opens a
// sheet instead, so it lives in its own client component.
const OPTIONS: Option[] = [
  {
    label: "Scheduled",
    href: "/schedule/upcoming",
    icon: Swords,
    iconClass: "bg-accent-light text-accent",
  },
  {
    label: "Completed",
    href: "/schedule/completed",
    icon: CheckCircle2,
    iconClass: "bg-credit-light text-credit-foreground",
  },
];

const TILE_CLASS =
  "flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface shadow-card p-4 text-left text-text-primary";

// The primary action spans the full width as a horizontal card; the two
// link tiles below it keep the square grid.
const ACTION_CLASS =
  "col-span-2 flex min-h-16 w-full flex-row items-center gap-3 rounded-lg border border-border bg-surface shadow-card p-4 text-left text-text-primary";

async function ScheduleData() {
  const nav = await getNavState();
  // Without a Team Ledger the Schedule tab IS the free sample: a
  // pre-made match to complete and share, entirely client-side.
  if (!nav.hasTeamLedger) return <GuestMatchFlow />;
  // Same gate the old /schedule/new page applied before showing its
  // button — an account still on its first-login password cannot write.
  const admin = await getSessionAdmin();
  return <ScheduleChooser canSchedule={!!admin && !admin.mustChangePassword} />;
}

function ScheduleChooser({ canSchedule }: { canSchedule: boolean }) {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">Schedule</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          See what&apos;s coming up, or put a new match on the calendar.
        </p>
      </div>
      <section className="grid grid-cols-2 gap-3">
        <ScheduleMatch canSchedule={canSchedule} tileClass={ACTION_CLASS} />
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <Link key={option.href} href={option.href} className={TILE_CLASS}>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-md",
                  option.iconClass,
                )}
              >
                <Icon size={18} />
              </span>
              <span className="text-sm font-semibold">{option.label}</span>
            </Link>
          );
        })}
      </section>
    </>
  );
}

export default function Schedule() {
  return (
    <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
      <ScheduleData />
    </Suspense>
  );
}
