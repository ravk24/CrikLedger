import { ceilRupees } from "./split";

// Car fee for a ground trip: round trip (2d) at ₹9.6/km, ceiled to a
// whole rupee. The admin reads d off Google Maps (Avval Chaha → ground).
export const CAR_RATE_PER_KM = 9.6;

export function carFee(distanceKm: number): number {
  if (distanceKm < 0) {
    throw new Error("NEGATIVE_DISTANCE");
  }
  return ceilRupees(2 * distanceKm * CAR_RATE_PER_KM);
}
