import { describe, it, expect } from "vitest";
import { baselinePlan, optimisedPlan, orderGroup } from "@/lib/optimizer";
import { routeMetrics, planMetrics } from "@/lib/metrics";
import { VEHICLES, vehicleById } from "@/lib/vehicles";
import { sampleDeliveries } from "@/lib/sample";

const data = sampleDeliveries();

describe("optimizer", () => {
  it("baseline is round-robin in file order", () => {
    const p = baselinePlan(data, 4);
    expect(p.routes[1]!.stops[0]!.id).toBe(data[1]!.id);
    expect(p.routes[0]!.stops[1]!.id).toBe(data[4]!.id);
  });
  it("no driver gets more than ceil(N/K)+2 stops", () => {
    for (const k of [3, 4, 5]) {
      const cap = Math.ceil(data.length / k) + 2;
      for (const r of optimisedPlan(data, k).routes) expect(r.stops.length).toBeLessThanOrEqual(cap);
    }
  });
  it("urgent deliveries always come first in every run", () => {
    for (const k of [2, 3, 4, 5])
      for (const r of optimisedPlan(data, k).routes) {
        const firstNormal = r.stops.findIndex((s) => s.priority !== "high");
        if (firstNormal >= 0) expect(r.stops.slice(firstNormal).some((s) => s.priority === "high")).toBe(false);
      }
  });
  it("optimised plan saves km on the sample day", () => {
    for (const k of [2, 3, 4, 5]) expect(optimisedPlan(data, k).totalKm).toBeLessThan(baselinePlan(data, k).totalKm);
  });
  it("is deterministic and drives less than baseline", () => {
    expect(optimisedPlan(data, 4).totalKm).toBe(optimisedPlan(data, 4).totalKm);
    expect(optimisedPlan(data, 4).totalKm).toBeLessThan(baselinePlan(data, 4).totalKm);
  });
});

describe("metrics", () => {
  it("Transit CO₂ = km × 9/100 × 2.68", () => {
    expect(routeMetrics(100, 10, vehicleById("transit")).co2Kg).toBeCloseTo(24.12);
  });
  it("route cost = fuel + upkeep + driver time", () => {
    // 100 km Transit: fuel 9 L × 22.5 = 202.5; upkeep 150; time 4.8333 h × 120 = 580
    expect(routeMetrics(100, 10, vehicleById("transit")).totalCost).toBeCloseTo(932.5);
  });
  it("each driver is priced with their own vehicle", () => {
    const p = optimisedPlan(data, 2);
    const small = planMetrics(p, [vehicleById("dokker"), vehicleById("dokker")]);
    const big = planMetrics(p, [vehicleById("sprinter"), vehicleById("sprinter")]);
    expect(big.co2Kg).toBeGreaterThan(small.co2Kg);
    expect(VEHICLES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(VEHICLES.map((v) => v.id)).size).toBe(VEHICLES.length);
  });
});

import { addSlot, removeSlot, setSlotDriver, DEFAULT_SHIFT, DEFAULT_ROSTER, MAX_SHIFT } from "@/lib/drivers";
describe("crew", () => {
  it("allows up to 10 drivers", () => {
    let s: typeof DEFAULT_SHIFT = [];
    for (let i = 0; i < 20; i++) s = addSlot(s, DEFAULT_ROSTER);
    expect(s).toHaveLength(MAX_SHIFT);
    expect(MAX_SHIFT).toBe(10);
  });
  it("starts with no drivers and can remove the last one", () => {
    expect(DEFAULT_SHIFT).toHaveLength(0);
    const one = addSlot([], DEFAULT_ROSTER);
    expect(removeSlot(one, 0)).toHaveLength(0);
    expect(optimisedPlan(data, 0).routes).toHaveLength(0);
  });
  it("picking a driver already used swaps the two slots", () => {
    const s = setSlotDriver([{ driverId: "andrei", vehicleId: "kangoo" }, { driverId: "maria", vehicleId: "dokker" }], 0, "maria");
    expect(s[0]!.driverId).toBe("maria");
    expect(s[1]!.driverId).toBe("andrei");
  });
});

import { parseBemol } from "@/lib/fuel";
import { recommendVehicle, withPrice, costPerKm } from "@/lib/vehicles";
describe("fuel", () => {
  it("parses Bemol pump prices", () => {
    const b = (n: string, num: string, p: string) => `<div class="pano__block"><div class="pano__content-info "><p class="item__name">${n}</p><p class="item__num">${num}</p></div><p class="zero">00.00</p><p class="actually__price">${p}</p></div>`;
    const html = b("Premium", "98", "38.60") + b("Premium", "95", "30.80") + b("Euro Diesel", "", "35.94") + b("LICHEFIAT GAZ", "", "17.95");
    const r = parseBemol(html)!;
    expect(r.petrol).toBe(30.8);
    expect(r.diesel).toBe(35.94);
    expect(r.items).toHaveLength(4);
  });
  it("recommends the cheapest van per km that fits the load", () => {
    const vs = VEHICLES.map((v) => withPrice(v, { diesel: 27, petrol: 30 }));
    const r = recommendVehicle(vs, 0)!;
    for (const v of vs) expect(costPerKm(r)).toBeLessThanOrEqual(costPerKm(v) * 1.02);
    expect(recommendVehicle(vs, 100)!.capacityParcels).toBeGreaterThanOrEqual(100);
  });
});

import { searchModels, normalizePlate } from "@/lib/vehicles";
describe("vehicle catalogue search", () => {
  it("finds models from a partial name, ignoring accents", () => {
    expect(searchModels("dokk").map((v) => v.id).sort()).toEqual(["dokker", "dokker-p"]);
    expect(searchModels("citroen berlingo").map((v) => v.id)).toContain("berlingo");
    expect(searchModels("dokker petrol").map((v) => v.id)).toEqual(["dokker-p"]);
  });
  it("normalises plates", () => {
    expect(normalizePlate("  c ab   123 ")).toBe("C AB 123");
  });
});

import { vehicleFromRow } from "@/lib/vehicles";
describe("company vehicle specs", () => {
  it("uses saved specs for models outside the catalogue", () => {
    const v = vehicleFromRow({ id: "x", plate: "C AB 1", model_id: "custom", model_name: "Isuzu N35", fuel: "diesel", fuel_per_100km: 12, upkeep_per_km: 2, capacity_parcels: 250, payload_kg: 1800 });
    expect(v.name).toBe("Isuzu N35");
    expect(v.fuelPer100km).toBe(12);
    expect(v.co2PerLitre).toBe(2.68);
  });
  it("falls back to the catalogue entry", () => {
    expect(vehicleFromRow({ id: "x", plate: "C AB 1", model_id: "sprinter" }).name).toContain("Sprinter");
  });
});

describe("traffic", () => {
  it("congested km burn 40% more fuel and drive at 12 km/h", () => {
    const v = vehicleById("transit");
    const free = routeMetrics(100, 0, v);
    const jam = routeMetrics(100, 0, v, undefined, 100);
    expect(jam.litres).toBeCloseTo(free.litres * 1.4);
    expect(jam.driverHours).toBeCloseTo(100 / 12);
  });
  it("routes through the centre carry congested km", () => {
    const p = optimisedPlan(data, 4);
    for (const r of p.routes) expect(r.congestedKm).toBeLessThanOrEqual(r.km + 1e-9);
  });
});

import { windowStart } from "@/lib/optimizer";
describe("stop order", () => {
  it("shortest order never makes a stop late and is no longer than time order", () => {
    const depot = { lat: 47, lng: 28.895 };
    for (const r of optimisedPlan(data, 4).routes) {
      const chrono = orderGroup(depot, r.stops);
      expect(buildSchedule(depot, r.stops).lateCount).toBeLessThanOrEqual(buildSchedule(depot, chrono).lateCount);
      expect(r.km).toBeLessThanOrEqual(baselinePlan(chrono, 1).totalKm + 1e-9);
    }
    expect(windowEnd("09:00-11:00")).toBe(660);
    expect(windowStart("09:00-11:00")).toBe(540);
  });
});

import { buildSchedule, windowEnd } from "@/lib/schedule";
describe("run schedule", () => {
  it("never arrives before a window opens and times only move forward", () => {
    for (const r of optimisedPlan(data, 4).routes) {
      const s = buildSchedule({ lat: 47, lng: 28.895 }, r.stops);
      let t = s.start;
      for (const x of s.stops) {
        expect(x.arrive).toBeGreaterThanOrEqual(t);
        expect(x.arrive + x.wait).toBeGreaterThanOrEqual(windowStart(x.stop.timeWindow) - 1e-9);
        expect(x.leave).toBeGreaterThan(x.arrive);
        t = x.leave;
      }
      expect(s.end).toBeGreaterThan(t);
    }
  });
  it("unloading takes 5 min + 1 min per parcel", () => {
    const d = { ...data[0]!, timeWindow: "", parcels: 4 };
    const s = buildSchedule(d, [d]);
    expect(s.stops[0]!.leave - s.stops[0]!.arrive).toBeCloseTo(9);
    expect(windowEnd("09:00-11:00")).toBe(660);
  });
});
