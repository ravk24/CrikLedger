import { VirtualFeeCalculator } from "@/components/more/VirtualFeeCalculator";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { TabBar } from "@/components/shared/TabBar";

export default function VirtualFee() {
  return (
    <div className="min-h-svh bg-background pb-28">
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">
            Virtual Match Fee
          </h1>
          <p className="mt-0.5 text-xs text-text-muted">
            Just for fun after the match — who <em>should</em> have paid what,
            by balls actually played. Nothing is saved.
          </p>
        </div>
        <VirtualFeeCalculator />
      </main>
      <TabBar />
    </div>
  );
}
