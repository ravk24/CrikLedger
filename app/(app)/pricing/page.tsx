import Link from "next/link";
import { HowPaymentWorks } from "@/components/shared/HowPaymentWorks";
import { ProductCard } from "@/components/shared/ProductCard";
import { PRODUCTS } from "@/lib/products";

export const metadata = {
  title: "Pricing · CrikLedger",
  description:
    "CrikLedger pricing — Ledger ₹99, refundable within 30 days, and Tournament ₹29, non-refundable. One-time purchases, no subscription.",
};

// PUBLIC and STATIC on purpose.
//
// /purchases is the in-app buy surface and sits behind the proxy matcher,
// so a signed-out visitor — a prospective customer — is redirected to
// /login and never sees a price. This page is the catalogue: no session
// reads, nothing dynamic, so it stays crawlable and prerendered. Do NOT
// add getNavState() here.
//
// The catalogue itself lives in lib/products.ts, which /pricing, Home
// and the refund copy all read, so a price or a refund term is stated
// once. When Feature 3 lands a products table, that file reads from it.
export default function Pricing() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">Pricing</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Simple one-time purchases. No monthly or annual subscription charges.
        </p>
      </div>

      {PRODUCTS.map((p) => (
        <ProductCard key={p.key} product={p} />
      ))}

      <HowPaymentWorks />

      <p className="text-center text-xs text-text-muted">
        Ready to buy?{" "}
        <Link
          href="/how-to-buy"
          className="text-accent underline underline-offset-2"
        >
          How payments work
        </Link>
      </p>
    </>
  );
}
