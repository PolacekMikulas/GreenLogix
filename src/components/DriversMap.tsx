import { useEffect, useRef } from "react";
import { tileUrl } from "@/lib/prefs";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_DEPOT } from "@/lib/optimizer";
import { DRIVER_COLORS } from "@/lib/drivers";

export interface DriverPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  at: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export default function DriversMap({ pins }: { pins: DriverPin[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { scrollWheelZoom: false }).setView([DEFAULT_DEPOT.lat, DEFAULT_DEPOT.lng], 12);
    L.tileLayer(tileUrl(), { attribution: "© OpenStreetMap" }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    pins.forEach((p, i) => {
      L.circleMarker([p.lat, p.lng], { radius: 8, color: "#ffffff", weight: 2, fillColor: DRIVER_COLORS[i % DRIVER_COLORS.length]!, fillOpacity: 1 })
        .bindTooltip(esc(p.name), { permanent: true, direction: "top", offset: [0, -8] })
        .bindPopup(`<b>${esc(p.name)}</b><br>Seen ${esc(p.at)}`)
        .addTo(g);
    });
    if (pins.length && map.current) map.current.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 14 });
  }, [pins]);

  return <div ref={el} className="h-[320px] w-full md:h-[400px]" />;
}
