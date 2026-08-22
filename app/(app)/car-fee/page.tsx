import { Suspense } from "react";
import { CarFeeCalculator } from "@/components/more/CarFeeCalculator";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveTeam } from "@/lib/team";

// Mirrors db/migration-26.sql:31 — teams.car_rate_per_km is
// NUMERIC(6,2) NOT NULL DEFAULT 9.6. Used when there is no team to
// read it from, so the calculator works signed out.
const DEFAULT_CAR_RATE_PER_KM = 9.6;

async function CarFeeData() {
  // carFee() is pure and the More tile links this page for everyone, so
  // a visitor without a team gets the schema default rather than a 500.
  // This used to call getCurrentTeam(), which throws NO_ACTIVE_TEAM —
  // and with no error.tsx anywhere in app/, that surfaced as a server
  // exception rather than a page.
  const team = await getActiveTeam();
  // Supabase hands NUMERIC back as a string; a bad value would
  // otherwise quietly price every distance at ₹0.
  const rate = team ? Number(team.car_rate_per_km) : NaN;
  const ratePerKm =
    Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_CAR_RATE_PER_KM;
  return (
    <>
      <p className="rounded-lg border border-border bg-surface shadow-card p-4 text-sm text-text-secondary">
        Open Google Maps and enter your{" "}
        <span className="font-semibold text-text-primary">
          starting location
        </span>{" "}
        and the destination as the{" "}
        <span className="font-semibold text-text-primary">
          Ground Location
        </span>
        , then enter the distance shown below.
      </p>
      <CarFeeCalculator ratePerKm={ratePerKm} />
    </>
  );
}

export default function CarFee() {
  return (
    <>
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
    </>
  );
}
