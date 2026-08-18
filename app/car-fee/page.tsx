import { Suspense } from "react";
import { CarFeeCalculator } from "@/components/more/CarFeeCalculator";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { TabBar } from "@/components/shared/TabBar";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentTeam } from "@/lib/team";

async function CarFeeData() {
  const team = await getCurrentTeam();
  return (
    <>
      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
        Open Google Maps and enter the starting location as{" "}
        <span className="font-semibold text-text-primary">
          {team.meeting_point ?? "your meeting point"}
        </span>{" "}
        and the destination as the{" "}
        <span className="font-semibold text-text-primary">
          Ground Location
        </span>
        , then enter the distance shown below.
      </p>
      <CarFeeCalculator ratePerKm={Number(team.car_rate_per_km)} />
    </>
  );
}

export default function CarFee() {
  return (
    <div className="min-h-svh bg-background pb-28">
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <h1 className="text-xl font-bold text-text-primary">
          Car Fee Calculator
        </h1>
        <Suspense
          fallback={
            <>
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
            </>
          }
        >
          <CarFeeData />
        </Suspense>
      </main>
      <TabBar />
    </div>
  );
}
