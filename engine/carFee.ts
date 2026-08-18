import { ceilRupees } from "./split";

// Car fee for a ground trip: round trip (2d) at the team's per-km rate
// (teams.car_rate_per_km — passed in by the caller; the engine stays
// pure), ceiled to a whole rupee. The admin reads d off Google Maps
// (team meeting point → ground).
export function carFee(distanceKm: number, ratePerKm: number): number {
  if (distanceKm < 0) {
    throw new Error("NEGATIVE_DISTANCE");
  }
  return ceilRupees(2 * distanceKm * ratePerKm);
}
