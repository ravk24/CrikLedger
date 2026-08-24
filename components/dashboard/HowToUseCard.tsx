import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type HowToStep = {
  label: string;
  sublabel: string;
  href: string;
  done: boolean;
};

// Live onboarding checklist for a freshly purchased feature. Every ✓ is
// computed from data, never stored; the whole card returns null
// (disappears) once every step is done — no dismiss button by design.
export function HowToUseCard({
  title,
  steps,
}: {
  title: string;
  steps: HowToStep[];
}) {
  if (steps.every((s) => s.done)) return null;
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-text-primary">
        {title}
      </h2>
      <ol className="divide-y divide-border">
        {steps.map((step, i) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className="flex min-h-14 items-center gap-3 px-4 py-3"
            >
              {step.done ? (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-credit-light text-credit-foreground">
                  <CheckCircle2 size={16} />
                </span>
              ) : (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-bold text-text-secondary">
                  {i + 1}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    step.done
                      ? "text-text-muted line-through"
                      : "text-text-primary",
                  )}
                >
                  {step.label}
                </span>
                <span className="block text-xs text-text-muted">
                  {step.sublabel}
                </span>
              </span>
              {!step.done && (
                <ChevronRight size={16} className="shrink-0 text-text-muted" />
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
