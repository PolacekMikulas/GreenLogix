// Real car-road distances and shapes from OSRM (OpenStreetMap, "driving" profile:
// only roads legal for cars, respecting one-way streets and turn restrictions).
import { haversineKm, type DistFn, type Point } from "./optimizer";

const OSRM = "https://router.project-osrm.org";
const key = (p: Point) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
const coords = (pts: Point[]) => pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");

/** Fetch an all-pairs road-distance matrix and return a DistFn (falls back to straight line for unknown points). */
export async function roadDistances(points: Point[]): Promise<DistFn> {
  const uniq: Point[] = [];
  const idx = new Map<string, number>();
  for (const p of points) if (!idx.has(key(p))) { idx.set(key(p), uniq.length); uniq.push(p); }
  const res = await fetch(`${OSRM}/table/v1/driving/${coords(uniq)}?annotations=distance`);
  if (!res.ok) throw new Error(`Road service error ${res.status}`);
  const json = (await res.json()) as { code: string; distances: (number | null)[][] };
  if (json.code !== "Ok") throw new Error(`Road service: ${json.code}`);
  const m = json.distances;
  return (a, b) => {
    const i = idx.get(key(a));
    const j = idx.get(key(b));
    const d = i != null && j != null ? m[i]?.[j] : null;
    return d != null ? d / 1000 : haversineKm(a, b) * 1.4;
  };
}

const shapeCache = new Map<string, [number, number][]>();

/** Street-following polyline (lat,lng pairs) through the points in order. */
export async function roadShape(points: Point[]): Promise<[number, number][]> {
  const c = coords(points);
  const hit = shapeCache.get(c);
  if (hit) return hit;
  const res = await fetch(`${OSRM}/route/v1/driving/${c}?overview=full&geometries=geojson`);
  if (!res.ok) throw new Error(`Road service error ${res.status}`);
  const json = (await res.json()) as { code: string; routes: { geometry: { coordinates: [number, number][] } }[] };
  if (json.code !== "Ok" || !json.routes[0]) throw new Error(`Road service: ${json.code}`);
  const line = json.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
  shapeCache.set(c, line);
  return line;
}
