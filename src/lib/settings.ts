// Dispatcher settings saved in this browser.
import { useEffect, useState } from "react";
import { DEFAULT_DEPOT } from "./optimizer";
import { CONSTANTS, type Constants } from "./metrics";

export interface Settings {
  depot: { label: string; lat: number; lng: number };
  minutesPerStop: number;
  driverCostPerHour: number;
}
const KEY = "greenlogix.settings.v1";
export const DEFAULT_SETTINGS: Settings = {
  depot: { ...DEFAULT_DEPOT },
  minutesPerStop: CONSTANTS.minutesPerStop,
  driverCostPerHour: CONSTANTS.driverCostPerHour,
};

export function loadSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEFAULT_SETTINGS; }
}
export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("greenlogix-settings"));
}
export function constantsFrom(s: Settings): Constants {
  return { ...CONSTANTS, minutesPerStop: s.minutesPerStop, driverCostPerHour: s.driverCostPerHour } as Constants;
}
export function useSettings(): Settings {
  const [s, setS] = useState(DEFAULT_SETTINGS);
  useEffect(() => {
    const up = () => setS(loadSettings());
    up();
    window.addEventListener("greenlogix-settings", up);
    return () => window.removeEventListener("greenlogix-settings", up);
  }, []);
  return s;
}
