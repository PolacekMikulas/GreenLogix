// Pure routing logic. No React here.
import { buildSchedule } from "./schedule";

export type ClientType = "horeca" | "retail" | "ecommerce";
export type Priority = "high" | "normal";

export interface Delivery {
  id: string;
  clientName: string;
  clientType: ClientType;
  address: string;
  district: string;
  lat: number;
  lng: number;
  priority: Priority;
  parcels: number;
  timeWindow: string;
}

export interface Point {
  lat: number;
  lng: number;
}

export interface DriverRoute {
  driverIndex: number;
  stops: Delivery[];
  km: number;
  /** Km driven through the congested city centre (stop-and-go traffic). */
  congestedKm: number;
}

export interface Plan {
  routes: DriverRoute[];
  totalKm: number;
}

export const DEFAULT_DEPOT: Point & { label: string } = {
  label: "str. Uzinelor, Chișinău",
  lat: 47.0,
  lng: 28.895,
};

export function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distance function in km. Defaults to straight-line; pass road distances for real routing. */
export type DistFn = (a: Point, b: Point) => number;

export function routeKm(depot: Point, stops: Point[], dist: DistFn = haversineKm): number {
  let km = 0;
  let prev: Point = depot;
  for (const s of stops) {
    km += dist(prev, s);
    prev = s;
  }
  if (stops.length) km += dist(prev, depot);
  return km;
}

/** Chișinău's rush-hour core (Centru, around bd. Ștefan cel Mare). */
export const CONGESTION_ZONE = { lat: 47.0245, lng: 28.8322, radiusKm: 2 };
/** Extra routing cost per congested km (stop-and-go burns ~40% more fuel). */
export const CONGESTION_PENALTY = 0.4;

/** Km of the straight leg a→b that lies inside the congestion zone (sampled). */
export function congestedLegKm(a: Point, b: Point, dist: DistFn = haversineKm): number {
  const km = dist(a, b);
  const N = 10;
  let inside = 0;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    const p = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    if (haversineKm(p, CONGESTION_ZONE) <= CONGESTION_ZONE.radiusKm) inside++;
  }
  return (km * inside) / N;
}

export function routeCongestedKm(depot: Point, stops: Point[], dist: DistFn = haversineKm): number {
  const pts = [depot, ...stops, ...(stops.length ? [depot] : [])];
  let ck = 0;
  for (let i = 1; i < pts.length; i++) ck += congestedLegKm(pts[i - 1]!, pts[i]!, dist);
  return ck;
}

/** Traffic-aware leg cost used by the optimiser. */
const legCostWith = (dist: DistFn) => (a: Point, b: Point) =>
  dist(a, b) + CONGESTION_PENALTY * congestedLegKm(a, b, dist);

function buildPlan(depot: Point, groups: Delivery[][], dist: DistFn): Plan {
  const routes = groups.map((stops, driverIndex) => ({
    driverIndex,
    stops,
    km: routeKm(depot, stops, dist),
    congestedKm: routeCongestedKm(depot, stops, dist),
  }));
  return { routes, totalKm: routes.reduce((s, r) => s + r.km, 0) };
}

/** BEFORE: arrival order, round-robin across drivers. */
export function baselinePlan(deliveries: Delivery[], drivers: number, depot: Point = DEFAULT_DEPOT, dist: DistFn = haversineKm): Plan {
  if (drivers < 1) return { routes: [], totalKm: 0 };
  const groups: Delivery[][] = Array.from({ length: drivers }, () => []);
  deliveries.forEach((d, i) => groups[i % drivers]!.push(d));
  return buildPlan(depot, groups, dist);
}

/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const sq = (a: Point, b: Point) => (a.lat - b.lat) ** 2 + ((a.lng - b.lng) * 0.68) ** 2;

/** k-means with deterministic k-means++ seeding. Returns cluster index per point. */
export function kmeans(points: Point[], k: number, seed = 42): number[] {
  const n = points.length;
  if (n === 0) return [];
  k = Math.min(k, n);
  const rand = rng(seed);
  const centres: Point[] = [{ ...points[Math.floor(rand() * n)]! }];
  while (centres.length < k) {
    const d = points.map((p) => Math.min(...centres.map((c) => sq(p, c))));
    const total = d.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let idx = 0;
    for (; idx < n - 1; idx++) {
      r -= d[idx]!;
      if (r <= 0) break;
    }
    centres.push({ ...points[idx]! });
  }
  let assign = new Array<number>(n).fill(0);
  for (let iter = 0; iter < 100; iter++) {
    const next = points.map((p) => {
      let best = 0;
      for (let c = 1; c < k; c++) if (sq(p, centres[c]!) < sq(p, centres[best]!)) best = c;
      return best;
    });
    const changed = next.some((v, i) => v !== assign[i]);
    assign = next;
    for (let c = 0; c < k; c++) {
      const members = points.filter((_, i) => assign[i] === c);
      if (members.length) {
        centres[c] = {
          lat: members.reduce((s, m) => s + m.lat, 0) / members.length,
          lng: members.reduce((s, m) => s + m.lng, 0) / members.length,
        };
      }
    }
    if (!changed && iter > 0) break;
  }
  return assign;
}

/** Cap each cluster at ceil(N/K)+2, moving farthest stops to the nearest cluster with room. */
export function balanceClusters(points: Point[], assign: number[], k: number): number[] {
  const out = [...assign];
  const cap = Math.ceil(points.length / k) + 2;
  const centre = (c: number): Point => {
    const m = points.filter((_, i) => out[i] === c);
    if (!m.length) return points[0]!;
    return { lat: m.reduce((s, p) => s + p.lat, 0) / m.length, lng: m.reduce((s, p) => s + p.lng, 0) / m.length };
  };
  for (let guard = 0; guard < points.length * k; guard++) {
    const sizes = Array.from({ length: k }, (_, c) => out.filter((a) => a === c).length);
    const over = sizes.findIndex((s) => s > cap);
    if (over < 0) break;
    const ctr = centre(over);
    const members = out.map((a, i) => (a === over ? i : -1)).filter((i) => i >= 0);
    members.sort((a, b) => sq(points[b]!, ctr) - sq(points[a]!, ctr));
    const far = members[0]!;
    const centres = Array.from({ length: k }, (_, c) => centre(c));
    let best = -1;
    for (let c = 0; c < k; c++) {
      if (c === over || sizes[c]! >= cap) continue;
      if (best < 0 || sq(points[far]!, centres[c]!) < sq(points[far]!, centres[best]!)) best = c;
    }
    if (best < 0) break;
    out[far] = best;
  }
  return out;
}

function nearestNeighbour(start: Point, stops: Delivery[], dist: DistFn): Delivery[] {
  const left = [...stops];
  const order: Delivery[] = [];
  let cur = start;
  while (left.length) {
    let bi = 0;
    for (let i = 1; i < left.length; i++) if (dist(cur, left[i]!) < dist(cur, left[bi]!)) bi = i;
    cur = left[bi]!;
    order.push(left.splice(bi, 1)[0]!);
  }
  return order;
}

/** 2-opt on a segment. `before` is the fixed point before it, `after` the fixed point after it. */
function twoOpt(before: Point, seg: Delivery[], after: Point, dist: DistFn): Delivery[] {
  const legCost = legCostWith(dist);
  let best = [...seg];
  const cost = (s: Delivery[]) => {
    let km = 0;
    let p: Point = before;
    for (const x of s) {
      km += legCost(p, x);
      p = x;
    }
    return km + legCost(p, after);
  };
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const cand = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        if (cost(cand) + 1e-9 < cost(best)) {
          best = cand;
          improved = true;
        }
      }
    }
  }
  return best;
}

/** Minutes after midnight for the start of "HH:MM-HH:MM"; empty windows sort last. */
export function windowStart(w: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(w.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60;
}

/** Minutes after midnight for the end of "HH:MM-HH:MM" (the latest delivery time), or null. */
export function windowEnd(w: string): number | null {
  const m = /-\s*(\d{1,2}):(\d{2})\s*$/.exec(w.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Sort key: latest delivery time, then window start, then urgent first. Untimed stops go last. */
export function chronoKey(s: Delivery): number {
  const end = windowEnd(s.timeWindow) ?? 24 * 60;
  return (s.priority === "high" ? 0 : 1e8) + end * 1440 + windowStart(s.timeWindow);
}

/** Chronological by latest delivery time; NN + 2-opt only inside identical-window blocks. */
export function orderGroup(depot: Point, stops: Delivery[], dist: DistFn = haversineKm): Delivery[] {
  const key = chronoKey;
  const keys = [...new Set(stops.map(key))].sort((a, b) => a - b);
  const blocks = keys.map((k) => stops.filter((s) => key(s) === k));
  const out: Delivery[] = [];
  let prev: Point = depot;
  blocks.forEach((b, i) => {
    const nn = nearestNeighbour(prev, b, dist);
    const next: Point = blocks[i + 1]?.[0] ?? depot;
    const opt = twoOpt(prev, nn, next, dist);
    out.push(...opt);
    prev = opt.at(-1) ?? prev;
  });
  return out;
}

/** AFTER: k-means areas, balanced, high priority first, NN + 2-opt. */
export function optimisedPlan(deliveries: Delivery[], drivers: number, depot: Point = DEFAULT_DEPOT, dist: DistFn = haversineKm): Plan {
  if (drivers < 1) return { routes: [], totalKm: 0 };
  const assign = balanceClusters(deliveries, kmeans(deliveries, drivers), drivers);
  const groups: Delivery[][] = Array.from({ length: drivers }, () => []);
  deliveries.forEach((d, i) => groups[assign[i]!]!.push(d));
  return buildPlan(depot, groups.map((g) => shortestOnTime(depot, orderGroup(depot, g, dist), dist)), dist);
}

/**
 * Start from the time-ordered run, then try 2-opt reversals and single-stop moves;
 * keep a change only if it shortens the run and no stop arrives later than before.
 */
export function shortestOnTime(depot: Point, stops: Delivery[], dist: DistFn = haversineKm): Delivery[] {
  const legCost = legCostWith(dist);
  const cost = (s: Delivery[]) => {
    let km = 0;
    let p: Point = depot;
    for (const x of s) { km += legCost(p, x); p = x; }
    return km + (s.length ? legCost(p, depot) : 0);
  };
  const late = (s: Delivery[]) => buildSchedule(depot, s, dist).lateCount;
  let best = [...stops];
  let bestCost = cost(best);
  const maxLate = late(best);
  const tryCand = (cand: Delivery[]) => {
    const c = cost(cand);
    const urgentFirst = cand.findIndex((s) => s.priority !== "high") < 0 || !cand.slice(cand.findIndex((s) => s.priority !== "high")).some((s) => s.priority === "high");
    if (urgentFirst && c + 1e-9 < bestCost && late(cand) <= maxLate) { best = cand; bestCost = c; return true; }
    return false;
  };
  let improved = true;
  for (let guard = 0; improved && guard < 200; guard++) {
    improved = false;
    for (let i = 0; i < best.length - 1 && !improved; i++)
      for (let j = i + 1; j < best.length && !improved; j++)
        improved = tryCand([...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)]);
    for (let i = 0; i < best.length && !improved; i++)
      for (let j = 0; j < best.length && !improved; j++) {
        if (i === j) continue;
        const rest = best.filter((_, k) => k !== i);
        rest.splice(j, 0, best[i]!);
        improved = tryCand(rest);
      }
  }
  return best;
}

export function mainDistrict(stops: Delivery[]): string {
  const counts = new Map<string, number>();
  for (const s of stops) counts.set(s.district, (counts.get(s.district) ?? 0) + 1);
  let best = "—";
  let n = 0;
  for (const [k, v] of counts) if (v > n) [best, n] = [k, v];
  return best;
}
