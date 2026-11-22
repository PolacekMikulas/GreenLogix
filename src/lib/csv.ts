import Papa from "papaparse";
import type { ClientType, Delivery } from "./optimizer";

export const FIELDS = [
  "id",
  "client_name",
  "client_type",
  "address",
  "district",
  "lat",
  "lng",
  "priority",
  "parcels",
  "time_window",
] as const;
export type Field = (typeof FIELDS)[number];
export type Mapping = Record<Field, string | null>;

export interface RawCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function readCsv(text: string): RawCsv {
  const res = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  return { headers: res.meta.fields ?? [], rows: res.data };
}

export function autoMapping(headers: string[]): { mapping: Mapping; complete: boolean } {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const mapping = Object.fromEntries(
    FIELDS.map((f) => [f, headers.find((h) => norm(h) === f) ?? null]),
  ) as Mapping;
  const hasCoords = mapping.lat !== null && mapping.lng !== null;
  const complete = FIELDS.every((f) => mapping[f] !== null || f === "lat" || f === "lng") && (hasCoords || mapping.address !== null);
  return { mapping, complete };
}

export interface ImportResult {
  deliveries: Delivery[];
  skipped: { row: number; reason: string }[];
  needsGeocoding: number;
  /** Rows with an address but no lat/lng; coordinates are NaN until geocoded. */
  toGeocode: Delivery[];
}

const TYPES: ClientType[] = ["horeca", "retail", "ecommerce"];

export function applyMapping(raw: RawCsv, m: Mapping): ImportResult {
  const deliveries: Delivery[] = [];
  const skipped: ImportResult["skipped"] = [];
  let needsGeocoding = 0;
  const toGeocode: Delivery[] = [];
  raw.rows.forEach((r, i) => {
    const get = (f: Field) => (m[f] ? (r[m[f]!] ?? "").trim() : "");
    const row = i + 2;
    const lat = parseFloat(get("lat").replace(",", "."));
    const lng = parseFloat(get("lng").replace(",", "."));
    const address = get("address");
    const noCoords = !Number.isFinite(lat) || !Number.isFinite(lng);
    if (noCoords && !address) {
      skipped.push({ row, reason: "no coordinates or address" });
      return;
    }
    const typeRaw = get("client_type").toLowerCase().replace(/[^a-z]/g, "");
    const clientType = (TYPES.includes(typeRaw as ClientType) ? typeRaw : "retail") as ClientType;
    const d: Delivery = {
      id: get("id") || `R${row}`,
      clientName: get("client_name") || "Unnamed client",
      clientType,
      address,
      district: get("district") || "—",
      lat,
      lng,
      priority: get("priority").toLowerCase() === "high" ? "high" : "normal",
      parcels: Math.max(1, parseInt(get("parcels"), 10) || 1),
      timeWindow: get("time_window"),
    };
    if (noCoords) {
      needsGeocoding++;
      toGeocode.push(d);
    } else deliveries.push(d);
  });
  return { deliveries, skipped, needsGeocoding, toGeocode };
}
