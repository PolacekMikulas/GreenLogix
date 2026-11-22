// Address → GPS via OpenStreetMap Nominatim (max 1 request/second), cached in the browser.
import type { Delivery } from "./optimizer";

const BOX = { minLat: 46.9, maxLat: 47.12, minLng: 28.7, maxLng: 29.0 }; // Chișinău area
const CACHE_KEY = "greenlogix.geocache.v1";
const inBox = (lat: number, lng: number) => lat >= BOX.minLat && lat <= BOX.maxLat && lng >= BOX.minLng && lng <= BOX.maxLng;

function loadCache(): Record<string, [number, number] | null> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
}

export async function query(q: string): Promise<[number, number] | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=md&viewbox=${BOX.minLng},${BOX.maxLat},${BOX.maxLng},${BOX.minLat}&bounded=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "Accept-Language": "ro" } });
  if (!res.ok) throw new Error(`Geocoder ${res.status}`);
  const j = (await res.json()) as { lat: string; lon: string }[];
  const lat = parseFloat(j[0]?.lat ?? ""), lng = parseFloat(j[0]?.lon ?? "");
  return Number.isFinite(lat) && inBox(lat, lng) ? [lat, lng] : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Geocodes deliveries; tries the full address, then without house number, then the district. */
export async function geocodeDeliveries(list: Delivery[], onProgress: (done: number, total: number) => void) {
  const cache = loadCache();
  const ok: Delivery[] = [];
  const failed: Delivery[] = [];
  let last = 0;
  for (let i = 0; i < list.length; i++) {
    const d = list[i]!;
    const base = d.address.replace(/,?\s*Moldova\s*$/i, "");
    const tries = [base, base.replace(/\s+\d+[a-z/\d]*\s*(?=,|$)/i, ""), d.district !== "—" ? `${d.district}, Chișinău` : ""].filter(Boolean);
    let hit: [number, number] | null = null;
    for (const q of tries) {
      if (q in cache) { hit = cache[q]!; if (hit) break; continue; }
      const wait = 1100 - (Date.now() - last);
      if (wait > 0) await sleep(wait);
      last = Date.now();
      try { hit = await query(q); } catch { hit = null; }
      cache[q] = hit;
      if (hit) break;
    }
    if (hit) ok.push({ ...d, lat: hit[0], lng: hit[1] }); else failed.push(d);
    onProgress(i + 1, list.length);
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* full */ }
  return { ok, failed };
}
