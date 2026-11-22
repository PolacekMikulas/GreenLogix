import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { toast } from "sonner";
import { Info, Minus, Plus, Lock, LockOpen, X, Upload, Sparkles, Database, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { baselinePlan, optimisedPlan, mainDistrict, DEFAULT_DEPOT, type Delivery, type DistFn } from "@/lib/optimizer";
import { roadDistances } from "@/lib/roads";
import { buildSchedule, clock } from "@/lib/schedule";
import { planMetrics, monthly } from "@/lib/metrics";
import { useSettings, constantsFrom } from "@/lib/settings";
import { VEHICLES, vehicleById, vehicleFromRow, type CompanyVehicleRow, withPrice, recommendVehicle, costPerKm, FALLBACK_PRICES } from "@/lib/vehicles";
import { getFuelPrices } from "@/lib/fuel.functions";
import type { FuelPrices } from "@/lib/fuel";
import { Fuel as FuelIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readCsv, autoMapping, applyMapping, FIELDS, type Mapping, type RawCsv } from "@/lib/csv";
import { geocodeDeliveries } from "@/lib/geocode";
import { sampleDeliveries } from "@/lib/sample";
import { isoDay, orderToDelivery, routable } from "@/lib/orders";
import { ClipboardList } from "lucide-react";
import { DRIVER_COLORS, DEFAULT_SHIFT, MIN_SHIFT, MAX_SHIFT, addSlot, removeSlot, setSlotDriver, type Driver, type ShiftSlot } from "@/lib/drivers";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";

const PlanMap = lazy(() => import("@/components/PlanMap"));

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { day?: string } =>
    typeof s["day"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s["day"]) ? { day: s["day"] } : {},
  head: () => ({
    meta: [
      { title: "Plan runs — GreenLogix" },
      { name: "description", content: "Plan tomorrow's courier runs in Chișinău: group deliveries by area and priority, and see km, CO₂ and money saved." },
      { property: "og:title", content: "Plan runs — GreenLogix" },
      { property: "og:description", content: "Group Chișinău deliveries by area and priority and see the savings in km, CO₂ and MDL." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanRuns,
});

const STORE = "greenlogix:v3";
const n1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const n0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const n2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const hm = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, "0")} min`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function PlanRuns() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [roster, setRoster] = useState<Driver[]>([]);
  const [myVans, setMyVans] = useState<CompanyVehicleRow[]>([]);
  const [shift, setShift] = useState<ShiftSlot[]>(DEFAULT_SHIFT);
  const [locked, setLocked] = useState(false);
  const drivers = shift.length;
  const [optimised, setOptimised] = useState(false);
  const [view, setView] = useState<"before" | "after">("after");
  const [open, setOpen] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapping, setMapping] = useState<{ raw: RawCsv; m: Mapping } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const settings = useSettings();
  const depot = settings.depot;
  const C = useMemo(() => constantsFrom(settings), [settings]);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? "null");
      if (s) {
        setDeliveries(s.deliveries ?? []);
        if (Array.isArray(s.shift) && s.shift.length >= MIN_SHIFT) setShift(s.shift);
        setOptimised(!!s.optimised);
        setLocked(!!s.locked);
      }
    } catch {}
    setLoaded(true);
    // Real team: only drivers the dispatcher invited.
    const fetchRoster = async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "driver");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) setRoster([]);
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids) : { data: [] };
      setRoster((profs ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email, phone: p.phone })));
      const { data: cv } = await supabase.from("company_vehicles").select("*").order("created_at");
      setMyVans(cv ?? []);
    };
    // Wait for the sign-in session; refetch when it changes.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") setTimeout(fetchRoster, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  // Drop crew rows whose driver isn't on the real team.
  useEffect(() => {
    if (loaded && roster.length) setShift((sh) => sh.filter((x) => roster.some((d) => d.id === x.driverId)));
  }, [roster, loaded]);
  // A locked day with no drivers left makes no sense — unlock it.
  useEffect(() => {
    if (loaded && locked && shift.length === 0) setLocked(false);
  }, [loaded, locked, shift.length]);
  useEffect(() => {
    if (loaded) localStorage.setItem(STORE, JSON.stringify({ deliveries, roster, shift, optimised, locked }));
  }, [loaded, deliveries, roster, shift, optimised, locked]);

  // Real car-road distances (OpenStreetMap) for every pair of stops + depot.
  const [roadDist, setRoadDist] = useState<DistFn | null>(null);
  useEffect(() => {
    setRoadDist(null);
    if (!deliveries.length) return;
    let alive = true;
    roadDistances([depot, ...deliveries])
      .then((fn) => alive && setRoadDist(() => fn))
      .catch(() => alive && toast.error("Couldn't reach the road map — using straight-line distances for now."));
    return () => {
      alive = false;
    };
  }, [deliveries, depot]);
  const dist = roadDist ?? undefined;
  const before = useMemo(() => baselinePlan(deliveries, drivers, depot, dist), [deliveries, drivers, depot, dist]);
  const after = useMemo(() => optimisedPlan(deliveries, drivers, depot, dist), [deliveries, drivers, depot, dist]);
  const [fuel, setFuel] = useState<FuelPrices | null | undefined>(undefined);
  useEffect(() => {
    getFuelPrices().then(setFuel).catch(() => setFuel(null));
  }, []);
  const prices = fuel ?? FALLBACK_PRICES;
  const priced = useMemo(() => VEHICLES.map((v) => withPrice(v, prices)), [prices.diesel, prices.petrol]);
  // Company vans (with plates) when the dispatcher has added some; else the catalogue.
  const options = useMemo(
    () => myVans.map((cv) => ({ ...withPrice(vehicleFromRow(cv), prices), id: cv.id, name: `${cv.plate} · ${vehicleFromRow(cv).name}` })),
    [myVans, priced, prices.diesel, prices.petrol],
  );
  const fleet = shift.map((s) => options.find((o) => o.id === s.vehicleId) ?? options[0] ?? priced[0]!);
  const mB = planMetrics(before, fleet, C);
  const mA = planMetrics(after, fleet, C);
  const month = monthly(mB, mA);
  const shown = view === "after" ? after : before;
  const names = shift.map((s) => roster.find((d) => d.id === s.driverId)?.name || `Run ${shift.indexOf(s) + 1}`);
  const addRow = () => {
    if (!options.length) { toast.info("No vehicles yet — add your vans on the Vehicles page"); return; }
    const free = options.find((o) => !shift.some((x) => x.vehicleId === o.id));
    if (!free) { toast.info("All your vehicles are already assigned"); return; }
    const next = addSlot(shift, roster, free.id);
    if (next === shift) toast.info(shift.length >= MAX_SHIFT ? `At most ${MAX_SHIFT} drivers per day` : roster.length ? "Everyone on the team is already assigned" : "No drivers yet — invite them on the Drivers page");
    else setShift(next);
  };
  const removeRow = (i: number) => {
    const next = removeSlot(shift, i);
    if (next === shift) toast.info(`At least ${MIN_SHIFT} drivers are needed`);
    else setShift(next);
  };

  const [ordersDate, setOrdersDate] = useState<string | null>(null);
  const { day: dayParam } = Route.useSearch();
  const loadOrders = async (day: string = dayParam ?? isoDay(1)) => {
    const { data, error } = await supabase.from("orders").select("*").eq("delivery_date", day).in("status", ["new", "planned"]);
    if (error) { toast.error("Couldn't load orders", { description: error.message }); return; }
    const ok = (data ?? []).filter(routable);
    const missing = (data ?? []).length - ok.length;
    if (!ok.length) { toast.info(`No open orders for ${day}`, { description: "Add them on the Orders page." }); return; }
    load(ok.map(orderToDelivery));
    setOrdersDate(day);
    toast.success(`Loaded ${ok.length} orders for ${day}`, { description: missing ? `${missing} skipped — address not on the map.` : undefined });
  };
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (!dayParam || autoLoaded.current) return;
    autoLoaded.current = true;
    const t = setTimeout(() => void loadOrders(dayParam), 400); // let the session hydrate
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayParam]);
  // Write each optimised run back to the order book: driver, stop number, status "planned".
  const assignOrders = async () => {
    if (!ordersDate || !optimised) return;
    const updates = after.routes.flatMap((r) =>
      r.stops.map((d, i) => supabase.from("orders").update({ status: "planned", driver_id: shift[r.driverIndex]?.driverId ?? null, stop_order: i + 1, updated_at: new Date().toISOString() }).eq("id", d.id)),
    );
    const res = await Promise.all(updates);
    const bad = res.filter((x) => x.error).length;
    if (bad) toast.error(`${bad} orders couldn't be assigned`);
    else toast.success(`${updates.length} orders assigned to drivers`);
  };

  const load = (list: Delivery[]) => {
    setOrdersDate(null);
    setDeliveries(list);
    setOptimised(false);
    setOpen(null);
  };

  const finishImport = async (raw: RawCsv, m: Mapping) => {
    const r = applyMapping(raw, m);
    let list = r.deliveries;
    const failed: string[] = [];
    if (r.toGeocode.length) {
      load(list);
      const id = toast.loading(`Finding ${r.toGeocode.length} addresses on the map…`);
      const g = await geocodeDeliveries(r.toGeocode, (done, total) => {
        toast.loading(`Finding addresses on the map… ${done}/${total}`, { id });
      });
      toast.dismiss(id);
      list = [...list, ...g.ok];
      g.failed.forEach((d) => failed.push(`${d.id}: address not found`));
    }
    load(list);
    const reasons = [...r.skipped.map((s) => `Row ${s.row}: ${s.reason}`), ...failed];
    toast.success(`Imported ${list.length} deliveries${reasons.length ? `, ${reasons.length} skipped` : ""}`, {
      description: reasons.slice(0, 5).join("\n") + (reasons.length > 5 ? "\n…" : "") || undefined,
    });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const raw = readCsv(await f.text());
    const { mapping: m, complete } = autoMapping(raw.headers);
    if (complete) finishImport(raw, m);
    else setMapping({ raw, m });
    if (fileRef.current) fileRef.current.value = "";
  };

  const counts = {
    horeca: deliveries.filter((d) => d.clientType === "horeca").length,
    retail: deliveries.filter((d) => d.clientType === "retail").length,
    ecommerce: deliveries.filter((d) => d.clientType === "ecommerce").length,
    urgent: deliveries.filter((d) => d.priority === "high").length,
  };

  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-background font-sans text-foreground">
        <AppHeader />

        <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-balance md:text-3xl">Tomorrow's delivery runs</h1>
              <p className="text-sm text-muted-foreground">
                {plural(deliveries.length, "delivery").replace("deliverys", "deliveries")} · {plural(drivers, "driver")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <Button variant="outline" onClick={() => loadOrders()}>
                <ClipboardList aria-hidden /> Load tomorrow's orders
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload aria-hidden /> Upload CSV
              </Button>
              <Button variant="outline" onClick={() => load(sampleDeliveries())}>
                <Database aria-hidden /> Load sample data
              </Button>
              <Button
                disabled={!deliveries.length || !drivers}
                onClick={() => {
                  setOptimised(true);
                  setView("after");
                }}
              >
                <Sparkles aria-hidden /> Optimise routes
              </Button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
            <aside className="space-y-5">
              <Card title="Deliveries">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="HoReCa" v={counts.horeca} />
                  <Stat label="Retail" v={counts.retail} />
                  <Stat label="E-commerce" v={counts.ecommerce} />
                  <Stat label="Urgent" v={counts.urgent} urgent />
                </dl>
              </Card>

              <Card title="Fuel prices today">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {(fuel?.items?.length ? fuel.items : [{ name: "Euro Diesel", price: prices.diesel }, { name: "Premium 95", price: prices.petrol }]).map((it) => (
                    <div key={it.name} className="rounded-lg border border-border p-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><FuelIcon className="size-3.5" aria-hidden />{it.name}</div>
                      <div className="text-lg font-semibold tabular-nums">{fuel === undefined ? "…" : `${it.price.toFixed(2)} MDL/L`}</div>
                    </div>
                  ))}
                </div>
                {!fuel && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {fuel === undefined ? "Loading Bemol prices…" : "Couldn't reach Bemol — using estimated prices."}
                  </p>
                )}
              </Card>

              <Card title="Today's crew">
                <p className="mb-3 text-xs text-muted-foreground">
                  {!drivers ? "No drivers yet — press “Add driver” to start." : locked ? "Locked — drivers can start work." : `Pick a driver and a van for each run · ${drivers} of ${MAX_SHIFT}`}
                </p>
                <ul className="space-y-3">
                  {shift.map((slot, i) => {
                    const v = fleet[i]!;
                    const d = roster.find((r) => r.id === slot.driverId);
                    const parcels = optimised ? (shown.routes[i]?.stops.reduce((t, x) => t + x.parcels, 0) ?? 0) : 0;
                    const over = parcels > v.capacityParcels;
                    const rec = recommendVehicle(options.filter((o) => !shift.some((x, k) => k !== i && x.vehicleId === o.id)), parcels);
                    return (
                      <li key={i} className="space-y-1.5 rounded-lg border border-border p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: DRIVER_COLORS[i] }} aria-hidden />
                          <span className="text-xs font-medium text-muted-foreground">Run {i + 1}</span>
                          {d?.phone && <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{d.phone}</span>}
                          {!locked && (
                            <Button variant="ghost" size="icon" className={`size-8 shrink-0 ${d?.phone ? "" : "ml-auto"}`} aria-label={`Remove run ${i + 1}`} disabled={drivers <= MIN_SHIFT} onClick={() => removeRow(i)}>
                              <X aria-hidden />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Select disabled={locked} value={slot.driverId} onValueChange={(id) => setShift(setSlotDriver(shift, i, id))}>
                            <SelectTrigger aria-label={`Driver for run ${i + 1}`} className="h-10 w-full min-w-0"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {roster.map((r) => (
                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select disabled={locked} value={v.id} onValueChange={(id) => setShift(shift.map((x, k) => (k === i ? { ...x, vehicleId: id } : x)))}>
                            <SelectTrigger aria-label={`Van for run ${i + 1}`} className="h-10 w-full min-w-0"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {options.map((o) => {
                                const usedBy = shift.findIndex((x, k) => k !== i && x.vehicleId === o.id);
                                return (
                                <SelectItem key={o.id} value={o.id} disabled={usedBy >= 0}>
                                  <span translate="no">{o.name}</span>
                                  {usedBy >= 0 && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Unavailable · Run {usedBy + 1}</span>}
                                  <span className="text-[11px] text-muted-foreground tabular-nums"> · {o.fuel === "diesel" ? "Diesel" : "Petrol"} · {costPerKm(o).toFixed(2)} MDL/km</span>
                                  {rec?.id === o.id && <span className="ml-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">Recommended</span>}
                                </SelectItem>
                              );})}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-[11px] tabular-nums text-muted-foreground">
                          <span className="rounded bg-muted px-1.5 py-0.5">{v.fuel === "diesel" ? "Diesel" : "Petrol"} · {v.fuelPer100km} L/100 km</span>
                          {rec && rec.id !== v.id && !locked && <span className="rounded bg-muted px-1.5 py-0.5">Tip: {rec.name} is cheaper</span>}
                          <span className="rounded bg-muted px-1.5 py-0.5">{n0.format(v.fuelPer100km * v.co2PerLitre * 10)} g CO₂/km</span>
                          <span className={`rounded px-1.5 py-0.5 ${over ? "bg-urgent text-white" : "bg-muted"}`}>
                            {optimised ? `${parcels}/` : ""}{v.capacityParcels} parcels
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {!locked && (
                  <Button variant="outline" className="mt-3 w-full" disabled={drivers >= MAX_SHIFT} onClick={addRow}>
                    <Plus aria-hidden /> Add driver
                  </Button>
                )}
                <Button
                  className="mt-3 w-full"
                  disabled={!drivers && !locked}
                  variant={locked ? "outline" : "default"}
                  onClick={() => {
                    setLocked(!locked);
                    if (!locked) toast.success("Crew locked for the day", { description: `${drivers} drivers can start work.` });
                    if (!locked) void assignOrders();
                  }}
                >
                  {locked ? <><LockOpen aria-hidden /> Unlock to edit</> : <><Lock aria-hidden /> Lock crew &amp; start the day</>}
                </Button>
              </Card>
            </aside>

            <section className="min-w-0 space-y-5">
              <div className="overflow-hidden rounded-[14px] border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
                  <div className="flex items-center gap-2">
                    <div role="tablist" className="flex rounded-lg bg-muted p-1 text-sm">
                      {(["before", "after"] as const).map((v) => (
                        <button
                          key={v}
                          role="tab"
                          type="button"
                          aria-selected={view === v}
                          disabled={!optimised}
                          onClick={() => setView(v)}
                          className={`rounded-md px-3 py-1.5 transition-colors disabled:opacity-50 ${view === v && optimised ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}
                        >
                          {v === "before" ? "Before: today's way" : "After: GreenLogix"}
                        </button>
                      ))}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label="How Before is calculated" className="text-muted-foreground">
                          <Info className="size-4" aria-hidden />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64">
                        Before = deliveries handed out in file order, round-robin (1 → driver 1, 2 → driver 2…), each driver visits them in that order.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {shift.map((x, i) => {
                      const d = roster.find((r) => r.id === x.driverId);
                      return d?.name ? (
                        <span key={x.driverId} className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-full" style={{ background: DRIVER_COLORS[i % DRIVER_COLORS.length] }} aria-hidden />
                          {d.name}
                        </span>
                      ) : null;
                    })}
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 rounded-full border-2 border-background bg-foreground ring-1 ring-foreground/20" aria-hidden /> Location
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full border-2 border-urgent bg-header" aria-hidden /> Urgent
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <ClientOnly fallback={<div className="h-[380px] bg-muted md:h-[480px]" />}>
                    <Suspense fallback={<div className="h-[380px] bg-muted md:h-[480px]" />}>
                      <PlanMap deliveries={deliveries} plan={optimised ? shown : null} showRoutes={optimised} depot={depot} driverNames={names} />
                    </Suspense>
                  </ClientOnly>
                  {optimised && (
                    <div className="absolute bottom-3 left-3 z-[400] rounded-full bg-header px-3 py-1.5 font-display text-sm text-white tabular-nums">
                      {n1.format(shown.totalKm)} km driven
                    </div>
                  )}
                  {!deliveries.length && (
                    <div className="absolute inset-0 z-[400] grid place-items-center bg-background/70 p-4 text-center">
                      <div>
                        <p className="font-display text-lg font-semibold">No deliveries yet</p>
                        <p className="text-sm text-muted-foreground">Upload tomorrow's CSV or load the sample day.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {optimised && (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Kpi
                      view={view}
                      title="Kilometres"
                      after={`${n1.format(mA.km)} km`}
                      before={`${n1.format(mB.km)} km`}
                      saved={`${n1.format(mB.km - mA.km)} km`}
                      pct={pct(mB.km, mA.km)}
                      per={`${n2.format(mB.kmPerDelivery)} → ${n2.format(mA.kmPerDelivery)} km per delivery`}
                      formula="km saved = km before − km after"
                    />
                    <Kpi
                      view={view}
                      title="CO₂ emitted"
                      after={`${n1.format(mA.co2Kg)} kg`}
                      before={`${n1.format(mB.co2Kg)} kg`}
                      saved={`${n1.format(mB.co2Kg - mA.co2Kg)} kg`}
                      pct={pct(mB.co2Kg, mA.co2Kg)}
                      per={`${n2.format(mB.co2PerDelivery)} → ${n2.format(mA.co2PerDelivery)} kg per delivery`}
                      formula="CO₂ = Σ each van: litres burned × kg CO₂ per litre (diesel 2.68, petrol 2.31)"
                    />
                    <Kpi
                      view={view}
                      title="Cost per delivery"
                      after={`${n2.format(mA.costPerDelivery)} MDL`}
                      before={`${n2.format(mB.costPerDelivery)} MDL`}
                      saved={`${n2.format(mB.costPerDelivery - mA.costPerDelivery)} MDL`}
                      pct={pct(mB.costPerDelivery, mA.costPerDelivery)}
                      per={view === "after" ? `Fuel ${n0.format(mA.fuelCost)} + upkeep ${n0.format(mA.upkeepCost)} + driver ${n0.format(mA.driverCost)} MDL (after)` : `Fuel ${n0.format(mB.fuelCost)} + upkeep ${n0.format(mB.upkeepCost)} + driver ${n0.format(mB.driverCost)} MDL (before)`}
                      formula={`(fuel + upkeep + driver time) ÷ deliveries, each van priced by its own model; time = km ÷ ${C.avgSpeedKmh} + stops × ${C.minutesPerStop} ÷ 60`}
                    />
                  </div>

                  <div className="overflow-x-auto rounded-[14px] border border-border bg-card">
                    <div className="border-b border-border p-4">
                      <h2 className="font-display font-semibold">Driver runs · {view === "after" ? "GreenLogix" : "today's way"}</h2>
                    </div>
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr>
                          {["Driver", "Vehicle", "Area", "Stops", "Urgent", "Distance", "In traffic", "Run time", ""].map((h) => (
                            <th key={h} className="px-4 py-2 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shown.routes.map((r) => { const sch = buildSchedule(depot, r.stops, dist, C); return (
                          <Fragment key={r.driverIndex}>
                            <tr className="border-t border-border">
                              <td className="px-4 py-3">
                                <span className="flex items-center gap-2 font-medium">
                                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: DRIVER_COLORS[r.driverIndex] }} aria-hidden />
                                  {names[r.driverIndex]}
                                </span>
                              </td>
                              <td className="px-4 py-3" translate="no">{fleet[r.driverIndex]?.name}</td>
                              <td className="px-4 py-3">{mainDistrict(r.stops)}</td>
                              <td className="px-4 py-3 tabular-nums">{r.stops.length}</td>
                              <td className="px-4 py-3 tabular-nums">{r.stops.filter((s) => s.priority === "high").length}</td>
                              <td className="px-4 py-3 tabular-nums">{n1.format(r.km)} km</td>
                              <td className="px-4 py-3 tabular-nums" title="Km through the rush-hour city centre, where stop-and-go burns ~40% more fuel">{n1.format(r.congestedKm)} km</td>
                              <td className="px-4 py-3 tabular-nums" title="Leaves the depot → back at the depot">
                                {r.stops.length ? <>{clock(sch.start)}–{clock(sch.end)}<div className="text-xs text-muted-foreground">{hm((sch.end - sch.start) / 60)}{sch.lateCount ? <span className="ml-1 font-medium text-urgent">· {sch.lateCount} late</span> : null}</div></> : "—"}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button size="sm" variant="ghost" aria-expanded={open === r.driverIndex} onClick={() => setOpen(open === r.driverIndex ? null : r.driverIndex)}>
                                  View stops <ChevronDown className={open === r.driverIndex ? "rotate-180" : ""} aria-hidden />
                                </Button>
                              </td>
                            </tr>
                            {open === r.driverIndex && (
                              <tr>
                                <td colSpan={9} className="bg-muted/50 px-4 py-3">
                                  <ol className="space-y-1.5">
                                    {sch.stops.map(({ stop: s }, i) => (
                                      <li key={s.id} className="flex items-center gap-3">
                                        <span className="w-6 shrink-0 text-right font-display tabular-nums text-muted-foreground">{i + 1}.</span>
                                        <span className="w-24 shrink-0 tabular-nums">{s.timeWindow || "Any time"}</span>
                                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                                          <span className="font-medium">{s.clientName}</span> — {s.address}, {s.district}
                                          {s.priority === "high" && <span className="ml-2 rounded bg-urgent px-1.5 py-0.5 text-xs font-medium text-white">Urgent</span>}
                                        </span>
                                      </li>
                                    ))}
                                  </ol>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <Button asChild size="sm" variant="outline">
                                      <a href={gmapsLink(depot, r.stops)} target="_blank" rel="noreferrer">Google Maps</a>
                                    </Button>
                                  </div>
                                  <p className="mt-2 text-xs text-muted-foreground">Google Maps opens every stop in order.</p>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ); })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </div>
        </main>

        <Dialog open={!!mapping} onOpenChange={(o) => !o && setMapping(null)}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Match your columns</DialogTitle>
              <DialogDescription>Some headers in your file have different names. Pick which column holds each field.</DialogDescription>
            </DialogHeader>
            {mapping && (
              <div className="space-y-2">
                {FIELDS.map((f) => (
                  <div key={f} className="flex items-center justify-between gap-3">
                    <Label htmlFor={`map-${f}`} className="font-mono text-xs">{f}</Label>
                    <select
                      id={`map-${f}`}
                      className="h-9 w-44 rounded-md border border-input bg-card px-2"
                      value={mapping.m[f] ?? ""}
                      onChange={(e) => setMapping({ ...mapping, m: { ...mapping.m, [f]: e.target.value || null } })}
                    >
                      <option value="">— not in file —</option>
                      {mapping.raw.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setMapping(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (mapping) finishImport(mapping.raw, mapping.m);
                  setMapping(null);
                }}
              >
                Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

const pct = (b: number, a: number) => (b > 0 ? Math.round(((b - a) / b) * 100) : 0);

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-4">
      <h2 className="mb-3 font-display font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, v, urgent }: { label: string; v: number; urgent?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/60 p-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`font-display text-xl font-semibold tabular-nums ${urgent ? "text-urgent" : ""}`}>{v}</dd>
    </div>
  );
}

function Kpi(p: { view: "before" | "after"; title: string; after: string; before: string; saved: string; pct: number; per: string; formula: string }) {
  const isAfter = p.view === "after";
  return (
    <div className="flex flex-col rounded-[14px] border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{p.title} · {isAfter ? "GreenLogix" : "today's way"}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{isAfter ? p.after : p.before}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        {isAfter ? (
          <>
            <span className="text-muted-foreground line-through tabular-nums">{p.before}</span>
            <span className="rounded-full bg-lime px-2 py-0.5 text-xs font-medium text-header tabular-nums">−{p.saved} ({p.pct}%)</span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground tabular-nums">GreenLogix: {p.after}</span>
            <span className="rounded-full bg-urgent px-2 py-0.5 text-xs font-medium text-white tabular-nums">+{p.saved} wasted</span>
          </>
        )}
      </div>
      <p className="mt-2 text-xs tabular-nums">{p.per}</p>
      <p className="mt-auto pt-3 font-mono text-[11px] leading-snug text-muted-foreground">{p.formula}</p>
    </div>
  );
}

function Big({ v, l }: { v: string; l: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold tabular-nums">{v}</p>
      <p className="text-xs text-white/70">{l}</p>
    </div>
  );
}

/** One Google Maps link with every stop in order (path format, no 9-waypoint cap). */
function gmapsLink(depot: { lat: number; lng: number }, stops: { lat: number; lng: number }[]): string {
  const pts = [depot, ...stops, depot].map((p) => `${p.lat},${p.lng}`);
  return `https://www.google.com/maps/dir/${pts.join("/")}/data=!4m2!4m1!3e0`;
}
