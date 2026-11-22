import { describe, it, expect } from "vitest";
import { routeMetrics } from "@/lib/metrics";
import { VEHICLES, withPrice } from "@/lib/vehicles";

describe("fuel savings follow the van's consumption and the fuel price", () => {
  it("litres = km × L/100 ÷ 100 and cost = litres × price", () => {
    const v = withPrice(VEHICLES[0]!, { diesel: 35.73, petrol: 30.52 });
    const m = routeMetrics(100, 0, v);
    expect(m.litres).toBeCloseTo(v.fuelPer100km);
    expect(m.fuelCost).toBeCloseTo(v.fuelPer100km * (v.fuel === "diesel" ? 35.73 : 30.52));
  });
});
