// Order pipeline: shapes and status flow. No React here.
import type { Delivery } from "./optimizer";
import type { Database } from "@/integrations/supabase/types";

export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];

export const STATUSES = ["new", "planned", "out_for_delivery", "delivered", "failed", "cancelled"] as const;
export type OrderStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  planned: "Planned",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Orders the planner can route: not finished and with GPS. */
export function routable(o: OrderRow): boolean {
  return (o.status === "new" || o.status === "planned") && o.lat != null && o.lng != null;
}

export function orderToDelivery(o: OrderRow): Delivery {
  return {
    id: o.id,
    clientName: o.client_name,
    clientType: (["horeca", "retail", "ecommerce"].includes(o.client_type) ? o.client_type : "retail") as Delivery["clientType"],
    address: o.address,
    district: o.district,
    lat: o.lat!,
    lng: o.lng!,
    priority: o.priority === "high" ? "high" : "normal",
    parcels: o.parcels,
    timeWindow: o.time_window,
  };
}

export function deliveryToOrder(d: Delivery, date: string): OrderInsert {
  return {
    ref: d.id,
    client_name: d.clientName,
    client_type: d.clientType,
    address: d.address,
    district: d.district,
    lat: Number.isFinite(d.lat) ? d.lat : null,
    lng: Number.isFinite(d.lng) ? d.lng : null,
    priority: d.priority,
    parcels: d.parcels,
    time_window: d.timeWindow,
    delivery_date: date,
  };
}

/** Local YYYY-MM-DD, offset by days. */
export function isoDay(offset = 0, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
