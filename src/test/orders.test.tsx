import { describe, expect, it } from "vitest";
import { isoDay, routable, type OrderRow } from "@/lib/orders";

const o = (p: Partial<OrderRow>) => ({ status: "new", lat: 47, lng: 28.8, ...p }) as OrderRow;

describe("order pipeline", () => {
  it("only routes new/planned orders that are on the map", () => {
    expect(routable(o({}))).toBe(true);
    expect(routable(o({ status: "planned" }))).toBe(true);
    expect(routable(o({ status: "delivered" }))).toBe(false);
    expect(routable(o({ status: "cancelled" }))).toBe(false);
    expect(routable(o({ lat: null }))).toBe(false);
  });
  it("tomorrow rolls over month end", () => {
    expect(isoDay(1, new Date(2026, 10, 30))).toBe("2026-12-01");
  });
});
