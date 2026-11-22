// Timed run schedule: arrival / departure per stop. No React here.
import { congestedLegKm, haversineKm, windowStart, windowEnd, type Delivery, type DistFn, type Point } from "./optimizer";
import { CONSTANTS, type Constants } from "./metrics";

/** Unloading time: fixed handover + 1 min per parcel (carry, scan, sign). */
export const MIN_PER_PARCEL = 1;

export { windowEnd };

export interface TimedStop {
  stop: Delivery;
  arrive: number; // minutes after midnight
  wait: number; // minutes waiting for the window to open
  leave: number;
  late: boolean;
}

export interface Schedule {
  start: number;
  end: number;
  stops: TimedStop[];
  lateCount: number;
}

/** Drive minutes for one leg: free-flow km at avg speed, centre km at rush-hour speed. */
export function legMinutes(a: Point, b: Point, dist: DistFn = haversineKm, c: Constants = CONSTANTS): number {
  const km = dist(a, b);
  const ck = Math.min(km, congestedLegKm(a, b, dist));
  return ((km - ck) / c.avgSpeedKmh + ck / c.congestedSpeedKmh) * 60;
}

/**
 * Leave the depot just in time to reach the first stop as its window opens,
 * then drive, wait for windows that haven't opened yet, unload, and return.
 */
export function buildSchedule(depot: Point, stops: Delivery[], dist: DistFn = haversineKm, c: Constants = CONSTANTS): Schedule {
  if (!stops.length) return { start: 0, end: 0, stops: [], lateCount: 0 };
  const firstOpen = windowStart(stops[0]!.timeWindow);
  const toFirst = legMinutes(depot, stops[0]!, dist, c);
  let t = (firstOpen < 24 * 60 ? firstOpen : 8 * 60) - toFirst;
  const start = t;
  let prev: Point = depot;
  const out: TimedStop[] = [];
  for (const s of stops) {
    const arrive = t + legMinutes(prev, s, dist, c);
    const open = windowStart(s.timeWindow);
    const begin = open < 24 * 60 ? Math.max(arrive, open) : arrive;
    const leave = begin + c.minutesPerStop + MIN_PER_PARCEL * s.parcels;
    const close = windowEnd(s.timeWindow);
    out.push({ stop: s, arrive, wait: begin - arrive, leave, late: close != null && arrive > close });
    t = leave;
    prev = s;
  }
  const end = t + legMinutes(prev, depot, dist, c);
  return { start, end, stops: out, lateCount: out.filter((x) => x.late).length };
}

export function clock(min: number): string {
  const m = Math.round(((min % 1440) + 1440) % 1440);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
