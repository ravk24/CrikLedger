import Link from "next/link";
import {
  ChevronRight,
  FileText,
  Info,
  Mail,
  Receipt,
  RotateCcw,
  Scale,
  Shield,
  ShoppingCart,
  Truck,
} from "lucide-react";

// The About us card from the More drawer: the hub for every policy
// document (terms, privacy, shipping, contact, cancellation/refunds) plus
// pricing and the buying instructions. Fully static — no session, no
// cookies — so a crawler or a signed-out visitor can read all of it.
const LINKS = [
  { href: "/about", label: "About", icon: Info },
  { href: "/contact", label: "Contact us", icon: Mail },
  { href: "/terms", label: "Terms & conditions", icon: Scale },
  { href: "/privacy", label: "Privacy policy", icon: Shield },
  {
    href: "/refund-policy",
    label: "Cancellation & refunds",
    icon: RotateCcw,
  },
  { href: "/shipping-policy", label: "Shipping & delivery", icon: Truck },
  { href: "/disclaimer", label: "Disclaimer", icon: FileText },
  { href: "/pricing", label: "Pricing", icon: Receipt },
  { href: "/how-to-buy", label: "How payments work", icon: ShoppingCart },
];

export default function AboutUs() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">About us</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Who we are, and the terms you are agreeing to.
        </p>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-14 items-center gap-3 px-4 py-3 text-text-primary"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
                <Icon size={17} />
              </span>
              <span className="flex-1 text-sm font-semibold">{label}</span>
              <ChevronRight size={16} className="shrink-0 text-text-muted" />
            </Link>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Refunds at a glance
        </h2>
        <p className="text-sm text-text-secondary">
          The <strong className="font-semibold text-text-primary">Ledger</strong>{" "}
          is refundable within 30 days of purchase, subject to the{" "}
          <Link
            href="/refund-policy"
            className="font-medium text-accent underline underline-offset-2"
          >
            cancellation &amp; refund policy
          </Link>
          . The{" "}
          <strong className="font-semibold text-text-primary">Tournament</strong>{" "}
          feature is not refundable.
        </p>
      </section>
    </>
  );
}
