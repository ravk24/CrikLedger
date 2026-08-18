import Link from "next/link";
import { LandPlot, MapPin } from "lucide-react";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { TabBar } from "@/components/shared/TabBar";
import { cn } from "@/lib/utils";

type Option = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
};

const OPTIONS: Option[] = [
  {
    label: "Barne Slots",
    href: "/slots",
    icon: LandPlot,
    iconClass: "bg-accent-light text-accent",
  },
  {
    label: "Other Slots",
    href: "/other-slots",
    icon: MapPin,
    iconClass: "bg-scheduled-light text-scheduled-foreground",
  },
];

export default function Schedule() {
  return (
    <div className="min-h-svh bg-background pb-28">
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Schedule</h1>
          <p className="mt-0.5 text-xs text-text-muted">
            Pick a ground to see its slots.
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
      </main>
      <TabBar />
    </div>
  );
}
