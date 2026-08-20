import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Shared frame for the policy and compliance pages.
//
// These must stay 100% STATIC — no session reads, no cookies. Search
// crawlers and signed-out visitors fetch them directly, and a dynamic
// read out here would both slow them down and fail the build under
// cacheComponents. If you ever want a "Signed in as…" line on one of
// these, that is the moment it breaks.
//
// The child styles below matter: the page bodies are plain JSX with no
// classes of their own, so lists, links, sub-headings and emphasis are
// styled once here. Without them the policy prose renders with browser
// defaults (serif bullets, blue underlined mailto links) in the middle
// of the app's design system.
export function PolicyPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Link
        href="/about-us"
        className="flex min-h-11 items-center gap-1 self-start text-sm font-medium text-text-secondary"
      >
        <ChevronLeft size={16} /> About us
      </Link>
      <div>
        <h1 className="text-xl font-bold text-text-primary">{title}</h1>
        <p className="mt-0.5 text-xs text-text-muted">Last updated {updated}</p>
      </div>
      <section
        className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-text-secondary
          [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-text-primary
          [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-text-primary
          [&_strong]:font-semibold [&_strong]:text-text-primary
          [&_a]:font-medium [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2
          [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5
          [&_li]:list-disc [&_li]:marker:text-text-muted
          [&_dl]:flex [&_dl]:flex-col [&_dl]:gap-0.5
          [&_dt]:font-semibold [&_dt]:text-text-primary"
      >
        {children}
      </section>
    </>
  );
}
