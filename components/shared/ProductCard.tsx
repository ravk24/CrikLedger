import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import type { Product } from "@/lib/products";

// One paid feature, as a card: price, tagline, what it includes, the
// product note and its refund terms.
//
// Static — no session read — so it is safe on the public /pricing page,
// which is now the only caller and uses the read-only form. Home used to
// render these two and no longer does: it links to /pricing instead, so
// the catalogue is met on the page that exists to hold it.
//
// The `href` branch (whole card as one tap target) is therefore unused
// today. Kept for the next surface that wants a linked card.
export function ProductCard({
  product,
  href,
}: {
  product: Product;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-text-primary">
          {product.name}
        </h2>
        <span className="text-2xl font-bold text-text-primary">
          {product.price}
        </span>
      </div>
      <p className="-mt-2 text-xs text-text-muted">{product.tagline}</p>

      <ul className="flex flex-col gap-1.5">
        {product.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-sm text-text-secondary"
          >
            <Check size={15} className="mt-0.5 shrink-0 text-credit" aria-hidden />
            {f}
          </li>
        ))}
      </ul>

      <p className="text-xs text-text-muted">{product.note}</p>
      <p
        className={
          product.refundable
            ? "text-xs font-medium text-credit"
            : "text-xs font-medium text-text-secondary"
        }
      >
        {product.refund}
      </p>
    </>
  );

  if (!href) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface shadow-card p-4">
        {body}
      </section>
    );
  }

  return (
    <Link
      href={href}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface shadow-card p-4"
    >
      {body}
      <span className="flex items-center gap-1 text-xs font-medium text-accent">
        How payments work
        <ChevronRight size={14} className="shrink-0" />
      </span>
    </Link>
  );
}
