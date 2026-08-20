import Link from "next/link";
import { Calculator, CarFront, ChevronRight, Receipt, Swords } from "lucide-react";
import type { NavState } from "@/lib/nav";

type NextStep = {
  label: string;
  hint: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
};

// What Home offers once the app IS installed.
//
// Before install, Home is the walkthrough. After it, that card alone is a
// dead end — the visitor has done the only thing it asked for. These are
// the four things someone without a Team Ledger can actually do next: buy
// in, try the sample, or use either calculator (both are pure and need no
// team). Same tile vocabulary as the More drawer, so nothing new to learn.
function buildSteps(nav: NavState): NextStep[] {
  return [
    nav.signedIn
      ? {
          label: "Get your Team Ledger",
          hint: "See plans and what each one unlocks",
          href: "/pricing",
          icon: Swords,
          iconClass: "bg-accent-light text-accent",
        }
      : {
          label: "Start your Team Ledger",
          hint: "Free to create — buy when you are ready",
          href: "/signup",
          icon: Swords,
          iconClass: "bg-accent-light text-accent",
        },
    {
      label: "Try a sample match",
      hint: "The full fee split — nothing is saved",
      href: "/schedule",
      icon: Receipt,
      iconClass: "bg-surface-secondary text-text-secondary",
    },
    {
      label: "Car Fee Calculator",
      hint: "What a driver is owed back",
      href: "/car-fee",
      icon: CarFront,
      iconClass: "bg-surface-secondary text-text-secondary",
    },
    {
      label: "Virtual Match Fee",
      hint: "Split a match without a ledger",
      href: "/virtual-fee",
      icon: Calculator,
      iconClass: "bg-surface-secondary text-text-secondary",
    },
  ];
}

export function NextSteps({ nav }: { nav: NavState }) {
  const steps = buildSteps(nav);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-text-primary">
        What next?
      </h2>
      <ul className="divide-y divide-border">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                className="flex min-h-16 items-center gap-3 px-4 py-3"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full ${s.iconClass}`}
                >
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text-primary">
                    {s.label}
                  </span>
                  <span className="block text-xs text-text-muted">
                    {s.hint}
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-text-muted"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
