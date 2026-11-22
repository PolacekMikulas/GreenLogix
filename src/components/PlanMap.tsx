import { useEffect, useRef } from "react";
import { tileUrl } from "@/lib/prefs";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Delivery, Plan, Point } from "@/lib/optimizer";
import { DRIVER_COLORS } from "@/lib/drivers";
import { roadShape } from "@/lib/roads";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export default function PlanMap({
  deliveries,
  plan,
  showRoutes,
  depot,
  driverNames,
}: {
  deliveries: Delivery[];
  plan: Plan | null;
  showRoutes: boolean;
  depot: Point;
  driverNames: string[];
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { scrollWheelZoom: false }).setView([47.02, 28.84], 12);
    L.tileLayer(tileUrl(), { attribution: "© OpenStreetMap" }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const where = new Map<string, { driver: number; stop: number }>();
    if (plan && showRoutes) {
      plan.routes.forEach((r) => {
        const color = DRIVER_COLORS[r.driverIndex % DRIVER_COLORS.length]!;
        const pts: L.LatLngExpression[] = [[depot.lat, depot.lng], ...r.stops.map((s) => [s.lat, s.lng] as L.LatLngExpression), [depot.lat, depot.lng]];
        const line = L.polyline(pts, { color, weight: 3, opacity: 0.35, dashArray: "4 6" }).addTo(g);
        // Swap the straight preview for the real street route once it arrives.
        roadShape([depot, ...r.stops, depot])
          .then((shape) => {
            if (!g.hasLayer(line)) return;
            line.setLatLngs(shape);
            line.setStyle({ opacity: 0.85, dashArray: "" });
          })
          .catch(() => {});
        r.stops.forEach((s, i) => where.set(s.id, { driver: r.driverIndex, stop: i + 1 }));
      });
    }
    deliveries.forEach((d) => {
      const w = where.get(d.id);
      const urgent = d.priority === "high";
      const assigned = w ? `${esc(driverNames[w.driver] ?? `Driver ${w.driver + 1}`)} · stop ${w.stop}` : "Not assigned yet";
      L.circleMarker([d.lat, d.lng], {
        radius: urgent ? 7 : 6,
        color: urgent ? "#C2410C" : "#ffffff",
        weight: urgent ? 3 : 2,
        fillColor: w ? DRIVER_COLORS[w.driver % DRIVER_COLORS.length]! : "#14281D",
        fillOpacity: 1,
      })
        .bindPopup(
          `<b>${esc(d.clientName)}</b><br>${esc(d.clientType)} · ${esc(d.district)}<br>${esc(d.address)}<br>Priority: ${d.priority}${urgent ? " ⚠" : ""} · ${d.parcels} parcels<br>Window: ${esc(d.timeWindow || "—")}<br><i>${assigned}</i>`,
        )
        .addTo(g);
    });
    L.marker([depot.lat, depot.lng], {
      icon: L.divIcon({
        className: "",
        iconSize: [52, 22],
        iconAnchor: [26, 11],
        html: '<div style="background:#14281D;color:#C8EF5A;border:2px solid #fff;padding:2px 6px;font:700 11px Space Grotesk,sans-serif;letter-spacing:.05em">DEPOT</div>',
      }),
    }).addTo(g);
    if (deliveries.length && map.current) {
      map.current.fitBounds(L.latLngBounds([[depot.lat, depot.lng], ...deliveries.map((d) => [d.lat, d.lng] as [number, number])]), { padding: [30, 30] });
    }
  }, [deliveries, plan, showRoutes, depot, driverNames]);

  return <div ref={el} className="h-[380px] w-full md:h-[480px]" />;
}
