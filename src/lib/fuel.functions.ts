import { createServerFn } from "@tanstack/react-start";
import { parseBemol, type FuelPrices } from "./fuel";

/** Live pump prices read from bemol.md/en/prices on every call. */
export const getFuelPrices = createServerFn({ method: "GET" }).handler(async (): Promise<FuelPrices | null> => {
  try {
    const res = await fetch("https://bemol.md/en/prices", { headers: { "User-Agent": "Mozilla/5.0 GreenLogix" } });
    if (!res.ok) return null;
    return parseBemol(await res.text());
  } catch {
    return null;
  }
});
