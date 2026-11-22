// App preferences (appearance, accessibility) saved in this browser.
export type Theme = "system" | "light" | "dark";
export type MapStyle = "standard" | "light" | "dark";
export type Lang = "en" | "ro" | "ru";
export interface Prefs {
  theme: Theme;
  mapStyle: MapStyle;
  textScale: number; // percent, 90–130
  lang: Lang;
}
const KEY = "greenlogix.prefs.v1";
export const DEFAULT_PREFS: Prefs = { theme: "system", mapStyle: "standard", textScale: 100, lang: "en" };

export const TILE_URLS: Record<MapStyle, string> = {
  standard: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

export function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEFAULT_PREFS; }
}
export function savePrefs(p: Prefs) {
  localStorage.setItem(KEY, JSON.stringify(p));
  applyPrefs(p);
}
export function tileUrl() {
  return TILE_URLS[loadPrefs().mapStyle];
}
export function applyPrefs(p: Prefs = loadPrefs()) {
  const el = document.documentElement;
  const dark = p.theme === "dark" || (p.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
  el.style.fontSize = p.textScale && p.textScale !== 100 ? `${p.textScale}%` : "";
  el.lang = p.lang;
  window.dispatchEvent(new Event("greenlogix-prefs"));
}
