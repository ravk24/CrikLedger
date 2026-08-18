import Link from "next/link";
import { Calculator, Car, CarFront, Trophy } from "lucide-react";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { TabBar } from "@/components/shared/TabBar";
import { cn } from "@/lib/utils";

type Feature = {
  label: string;
  href: string | null; // null = not built yet, renders disabled
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
};

// The app drawer: future v2 features land here. Ship a feature by
// filling in its href (and label/icon) — the tile becomes a link.
const FEATURES: Feature[] = [
  {
    label: "Car Fee Calculator",
    href: "/car-fee",
    icon: Car,
    iconClass: "bg-accent-light text-accent",
  },
  {
    label: "Car Counter",
    href: "/car-count",
    icon: CarFront,
    iconClass: "bg-scheduled-light text-scheduled-foreground",
  },
  {
    label: "Virtual Match Fee",
    href: "/virtual-fee",
    icon: Calculator,
    iconClass: "bg-credit-light text-credit-foreground",
  },
  {
    label: "Tournaments",
    href: "/tournaments",
    icon: Trophy,
    iconClass: "bg-low-light text-low-foreground",
  },
];

export default function More() {
  return (
    <div className="min-h-svh bg-background pb-28">
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">More</h1>
          <p className="mt-0.5 text-xs text-text-muted">
            New features land here.
          </p>
        </div>
        <section className="grid grid-cols-2 gap-3">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            const inner = (
              <>
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md",
                    feature.iconClass,
                  )}
                >
                  <Icon size={18} />
                </span>
                <span className="text-sm font-semibold">{feature.label}</span>
              </>
            );
            return feature.href ? (
              <Link
                key={i}
                href={feature.href}
                className="flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface p-4 text-text-primary"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={i}
                aria-disabled="true"
                className="flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface p-4 text-text-muted opacity-70"
              >
                {inner}
              </div>
            );
          })}
        </section>
      </main>
      <TabBar />
    </div>
  );
}
