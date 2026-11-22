// Pure fuel-price parsing (Bemol station prices). No React here.
export interface FuelItem { name: string; price: number } // MDL/L
export interface FuelPrices {
  diesel: number; // MDL/L — Euro Diesel
  petrol: number; // MDL/L — Premium 95
  items: FuelItem[]; // every product listed, in page order
  fetchedAt: string; // ISO time we read the page
  source: "Bemol";
}

const clean = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export function parseBemol(html: string, now = new Date()): FuelPrices | null {
  const items: FuelItem[] = [];
  for (const block of html.split(/class="pano__block"/).slice(1)) {
    const info = block.match(/pano__content-info[^>]*>([\s\S]*?)<\/div>/);
    const price = block.match(/class="actually__price"[^>]*>\s*([\d.,]+)/);
    if (!info || !price) continue;
    const name = clean(info[1]!);
    const p = Number(price[1]!.replace(",", "."));
    if (name && p > 0) items.push({ name, price: p });
  }
  const find = (re: RegExp) => items.find((i) => re.test(i.name))?.price;
  const diesel = find(/diesel|motorin/i);
  const petrol = find(/\b95\b/);
  if (!diesel || !petrol) return null;
  return { diesel, petrol, items, fetchedAt: now.toISOString(), source: "Bemol" };
}
