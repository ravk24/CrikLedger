import Link from "next/link";
import { ChevronLeft, Shield } from "lucide-react";
import { AppHeader } from "@/components/shared/AppHeader";

// Operator pages wear the app's own navbar (brand, account menu, theme)
// and the global copyright footer — but NO tab bar, and an explicit
// badge so the two authorities never look like the same surface.
// Rendered by each page AFTER its guard has passed, never by the
// layout (see app/ops/layout.tsx for why), so it owns the page frame
// the (app) layout would otherwise provide.
export function OpsChrome({
  backHref,
  children,
}: {
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-between">
          {backHref ? (
            <Link
              href={backHref}
              className="flex min-h-11 items-center gap-1 text-sm font-medium text-text-secondary"
            >
              <ChevronLeft size={16} /> Operator console
            </Link>
          ) : (
            <h1 className="text-xl font-bold text-text-primary">
              Operator console
            </h1>
          )}
          <span className="flex items-center gap-1 rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            <Shield size={12} /> Operator
          </span>
        </div>
        {children}
      </main>
    </>
  );
}
