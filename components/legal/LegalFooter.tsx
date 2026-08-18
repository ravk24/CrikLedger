import Link from "next/link";

// Legal links at the end of page content.
//
// Deliberately IN FLOW rather than added to the fixed CopyrightBar: that
// bar is 24px tall and its height is hard-coded into four tab bars as
// `bottom-[calc(24px+env(safe-area-inset-bottom))]` plus ~10 page
// paddings. Growing it to fit these links would mean changing every one
// of those in lockstep, and any miss overlaps the tab bar on a real
// device. End-of-content is also where people look for these.
//
// Static — no session reads — so it is safe in the (app) layout and on
// the auth pages, and a reviewer or crawler always sees it.
const LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund-policy", label: "Refunds" },
  { href: "/shipping-policy", label: "Delivery" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export function LegalFooter() {
  return (
    <nav
      aria-label="Legal"
      className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border pt-4 text-[11px] text-text-muted"
    >
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-text-secondary">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
