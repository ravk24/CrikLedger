import { Suspense } from "react";
import Link from "next/link";
import { CalendarPlus, Swords } from "lucide-react";
import { GuestMatchFlow } from "@/components/guest/GuestMatchFlow";
import { Skeleton } from "@/components/ui/skeleton";
import { getNavState } from "@/lib/nav";
import { cn } from "@/lib/utils";

type Option = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
};

const OPTIONS: Option[] = [
  {
    label: "Scheduled Matches",
    href: "/schedule/upcoming",
    icon: Swords,
    iconClass: "bg-accent-light text-accent",
  },
  {
    label: "Schedule a Match",
    href: "/schedule/new",
    icon: CalendarPlus,
    iconClass: "bg-scheduled-light text-scheduled-foreground",
  },
];

async function ScheduleData() {
  const nav = await getNavState();
  // Without a Team Ledger the Schedule tab IS the free sample: a
  // pre-made match to complete and share, entirely client-side.
  if (!nav.hasTeamLedger) return <GuestMatchFlow />;
  return <ScheduleChooser />;
}

function ScheduleChooser() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">Schedule</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          See what&apos;s coming up, or put a new match on the calendar.
        </p>
      </div>
      <section className="grid grid-cols-2 gap-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <Link
              key={option.href}
              href={option.href}
              className="flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface p-4 text-text-primary"
            >
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
