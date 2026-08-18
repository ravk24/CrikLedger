"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

type Props = {
  segment?: string; // e.g. "matches" → /tournaments/<id>/matches; omit for Home
  label: string;
};

function BackLinkInner({ segment, label }: Props) {
  const pathname = usePathname();
  const base = pathname.split("/").slice(0, 3).join("/");
  return (
    <Link
      href={segment ? `${base}/${segment}` : base}
      className="flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-text-secondary"
    >
      <ChevronLeft size={18} />
      {label}
    </Link>
  );
}

// Back-chevron for tournament detail pages. The href derives from the
// pathname — runtime data under Cache Components — so the linked
// version streams in over a static look-alike fallback.
export function TournamentBackLink({ segment, label }: Props) {
  return (
    <Suspense
      fallback={
        <span className="flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-text-secondary">
          <ChevronLeft size={18} />
          {label}
        </span>
      }
    >
      <BackLinkInner segment={segment} label={label} />
    </Suspense>
  );
}
