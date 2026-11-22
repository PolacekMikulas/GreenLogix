// Pure cost / CO₂ math. No React here.
import type { Plan } from "./optimizer";
import type { Vehicle } from "./vehicles";

/** Fixed operating constants (not vehicle-specific). */
export const CONSTANTS = {
  driverCostPerHour: 120, // MDL/h
  avgSpeedKmh: 25,
  minutesPerStop: 5,
  workingDaysPerMonth: 22,
  congestedSpeedKmh: 12, // rush-hour centre
  congestionFuelFactor: 1.4, // stop-and-go burns ~40% more fuel per km

} as const;
export type Constants = typeof CONSTANTS;

export interface Metrics {
  km: number;
  litres: number;
  co2Kg: number;
  fuelCost: number;
  upkeepCost: number;
  driverHours: number;
  driverCost: number;
  totalCost: number;
  costPerDelivery: number;
  kmPerDelivery: number;
  co2PerDelivery: number;
}

export function driverHours(km: number, stops: number, c: Constants = CONSTANTS, congestedKm = 0) {
  const free = Math.max(0, km - congestedKm);
  const drive = c.avgSpeedKmh > 0 ? free / c.avgSpeedKmh + congestedKm / c.congestedSpeedKmh : 0;
  return drive + (stops * c.minutesPerStop) / 60;
}

export function routeMetrics(km: number, stops: number, v: Vehicle, c: Constants = CONSTANTS, congestedKm = 0) {
  const ck = Math.min(congestedKm, km);
  const litres = (km - ck + ck * c.congestionFuelFactor) * (v.fuelPer100km / 100);
  const hours = driverHours(km, stops, c, ck);
  const fuelCost = litres * v.fuelPrice;
  const upkeepCost = km * v.upkeepPerKm;
  const driverCost = hours * c.driverCostPerHour;
  return { km, litres, co2Kg: litres * v.co2PerLitre, fuelCost, upkeepCost, driverHours: hours, driverCost, totalCost: fuelCost + upkeepCost + driverCost };
}

/** Sum of every driver's route, each priced with that driver's vehicle. */
export function planMetrics(plan: Plan, fleet: Vehicle[], c: Constants = CONSTANTS): Metrics {
  const sum = { km: 0, litres: 0, co2Kg: 0, fuelCost: 0, upkeepCost: 0, driverHours: 0, driverCost: 0, totalCost: 0 };
  let deliveries = 0;
  for (const r of plan.routes) {
    const m = routeMetrics(r.km, r.stops.length, fleet[r.driverIndex] ?? fleet[0]!, c, r.congestedKm);
    for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += m[k];
    deliveries += r.stops.length;
  }
  const per = (v: number) => (deliveries > 0 ? v / deliveries : 0);
  return { ...sum, costPerDelivery: per(sum.totalCost), kmPerDelivery: per(sum.km), co2PerDelivery: per(sum.co2Kg) };
}

export function monthly(before: Metrics, after: Metrics, c: Constants = CONSTANTS) {
  const d = c.workingDaysPerMonth;
  return {
    kmSaved: (before.km - after.km) * d,
    mdlSaved: (before.totalCost - after.totalCost) * d,
    co2Saved: (before.co2Kg - after.co2Kg) * d,
  };
}

export interface VanSaving {
  driverIndex: number;
  vehicle: Vehicle;
  before: ReturnType<typeof routeMetrics>;
  after: ReturnType<typeof routeMetrics>;
}

/** Per-van comparison: same van, today's route vs optimised route. */
export function vanSavings(before: Plan, after: Plan, fleet: Vehicle[], c: Constants = CONSTANTS): VanSaving[] {
  return fleet.map((vehicle, i) => {
    const b = before.routes.find((r) => r.driverIndex === i);
    const a = after.routes.find((r) => r.driverIndex === i);
    return {
      driverIndex: i,
      vehicle,
      before: routeMetrics(b?.km ?? 0, b?.stops.length ?? 0, vehicle, c, b?.congestedKm ?? 0),
      after: routeMetrics(a?.km ?? 0, a?.stops.length ?? 0, vehicle, c, a?.congestedKm ?? 0),
    };
  });
}
