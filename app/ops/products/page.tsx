import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsHeader } from "@/components/ops/OpsHeader";
import { requireMegaadminPage } from "@/components/ops/guard";

async function StubData() {
  await requireMegaadminPage("/ops/products");
  return (
    <>
      <OpsHeader />
      <h1 className="text-xl font-bold text-text-primary">Products</h1>
      <section className="rounded-lg border border-dashed border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text-primary">Owned by Feature 3</p>
      <p className="mt-1 text-sm text-text-secondary">The product catalogue and price list, editable here rather than in a deploy.</p>
      </section>
    </>
  );
}

// Deliberately a stub with its owner named, so the gap is visible in the
// console rather than looking like a page that failed to load.
export default function OpsProducts() {
  return (
    <Suspense fallback={<Skeleton className="h-32 rounded-lg" />}>
      <StubData />
    </Suspense>
  );
}
