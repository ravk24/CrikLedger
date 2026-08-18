import { CarFeeCalculator } from "@/components/more/CarFeeCalculator";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { TabBar } from "@/components/shared/TabBar";

export default function CarFee() {
  return (
    <div className="min-h-svh bg-background pb-28">
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <h1 className="text-xl font-bold text-text-primary">
          Car Fee Calculator
        </h1>
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
          Open Google Maps and enter the starting location as{" "}
          <span className="font-semibold text-text-primary">Avval Chaha</span>{" "}
          and the destination as the{" "}
          <span className="font-semibold text-text-primary">
            Ground Location
          </span>
          , then enter the distance shown below.
        </p>
        <CarFeeCalculator />
      </main>
      <TabBar />
    </div>
  );
}
