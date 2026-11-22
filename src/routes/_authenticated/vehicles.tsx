import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Trash2, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { co2PerKm, normalizePlate, searchModels, vehicleFromRow, type Vehicle } from "@/lib/vehicles";
import { useServerFn } from "@tanstack/react-start";
import { lookupVehicleSpecs } from "@/lib/vehicle-specs.functions";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vehicles")({
  head: () => ({
    meta: [
      { title: "Vehicles — GreenLogix" },
      { name: "description", content: "Your company's vans with number plates, fuel use, CO₂ and capacity filled in from the model catalogue." },
      { property: "og:title", content: "Vehicles — GreenLogix" },
      { property: "og:description", content: "Add your vans by model and number plate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VehiclesPage,
});

const n0 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

function VehiclesPage() {
  const qc = useQueryClient();
  const vans = useQuery({
    queryKey: ["company_vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_vehicles").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const role = useQuery({
    queryKey: ["my_dispatcher"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "dispatcher");
      return (data?.length ?? 0) > 0;
    },
  });
  const canEdit = role.data === true;
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; plate: string } | null>(null);
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company_vehicles"] }); toast.success("Vehicle removed"); },
    onError: (e: Error) => toast.error("Couldn't remove vehicle", { description: e.message }),
  });

  return (
    <div className="min-h-dvh bg-background font-sans text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-balance md:text-3xl">Vehicles</h1>
            <p className="text-sm text-muted-foreground">Your company's vans. Pick a model, add the plate — fuel use, CO₂ and capacity come with it.</p>
          </div>
          {canEdit ? (
            <Button onClick={() => setOpen(true)}><Plus aria-hidden /> Add vehicle</Button>
          ) : role.isSuccess ? (
            <p className="text-sm text-muted-foreground">Only dispatchers can add or remove vehicles.</p>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {vans.isLoading ? (
            <div className="h-40 animate-pulse bg-muted" />
          ) : vans.error ? (
            <p className="p-6 text-sm text-destructive">Couldn't load vehicles: {(vans.error as Error).message}</p>
          ) : !vans.data?.length ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Truck className="size-8 text-muted-foreground" aria-hidden />
              <p className="font-medium">No vehicles yet</p>
              <p className="text-sm text-muted-foreground">Add your first van to use it in tomorrow's crew.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Plate</th>
                    <th className="px-4 py-2.5 font-medium">Model</th>
                    <th className="px-4 py-2.5 font-medium">Fuel</th>
                    <th className="px-4 py-2.5 font-medium">L/100 km</th>
                    <th className="px-4 py-2.5 font-medium">CO₂</th>
                    <th className="px-4 py-2.5 font-medium">Capacity</th>
                    <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {vans.data.map((cv) => {
                    const m = vehicleFromRow(cv);
                    return (
                      <tr key={cv.id} className="border-t border-border">
                        <td className="px-4 py-3 font-semibold tabular-nums" translate="no">{cv.plate}</td>
                        <td className="px-4 py-3" translate="no">{m.name}<div className="text-xs text-muted-foreground">{m.kind}</div></td>
                        <td className="px-4 py-3">{m.fuel === "diesel" ? "Diesel" : "Petrol"}</td>
                        <td className="px-4 py-3 tabular-nums">{m.fuelPer100km}</td>
                        <td className="px-4 py-3 tabular-nums">{n0.format(co2PerKm(m) * 1000)} g/km</td>
                        <td className="px-4 py-3 tabular-nums">{m.capacityParcels} parcels · {n0.format(m.payloadKg)} kg</td>
                        <td className="px-4 py-3 text-right">
                          {canEdit && <Button variant="ghost" size="icon" aria-label={`Remove ${cv.plate}`} onClick={() => setToDelete({ id: cv.id, plate: cv.plate })}>
                            <Trash2 aria-hidden />
                          </Button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Model figures are typical city values for each van; prices come from live Bemol pump prices on the plan page.</p>
      </main>

      <AddVehicleDialog open={open} onOpenChange={setOpen} />
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {toDelete?.plate}?</AlertDialogTitle>
            <AlertDialogDescription>It will no longer be available when picking vans for a run.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && del.mutate(toDelete.id)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddVehicleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [model, setModel] = useState<Vehicle | null>(null);
  const [custom, setCustom] = useState(false);
  const lookup = useServerFn(lookupVehicleSpecs);
  const find = useMutation({
    mutationFn: () => lookup({ data: { query: q } }),
    onSuccess: (r) => {
      if (!r.specs) return setErr(r.error ?? "Not found");
      const s = r.specs;
      setErr("");
      setCustom(true);
      setModel({ id: "custom", name: s.name, kind: s.kind, fuel: s.fuel, fuelPer100km: Math.round(s.fuelPer100km * 10) / 10, upkeepPerKm: Math.round(s.upkeepPerKm * 100) / 100, capacityParcels: Math.round(s.capacityParcels), payloadKg: Math.round(s.payloadKg), fuelPrice: 0, co2PerLitre: s.fuel === "diesel" ? 2.68 : 2.31 });
      setQ(s.name);
      setTimeout(() => plateRef.current?.focus(), 0);
    },
    onError: () => setErr("Lookup failed, try again."),
  });
  const [plate, setPlate] = useState("");
  const [err, setErr] = useState("");
  const plateRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchModels(q), [q]);

  const reset = () => { setQ(""); setModel(null); setCustom(false); setPlate(""); setErr(""); };
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("company_vehicles").insert({
        model_id: model!.id,
        plate: normalizePlate(plate),
        ...(custom ? { model_name: model!.name, kind: model!.kind, fuel: model!.fuel, fuel_per_100km: model!.fuelPer100km, upkeep_per_km: model!.upkeepPerKm, capacity_parcels: model!.capacityParcels, payload_kg: model!.payloadKg } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company_vehicles"] });
      toast.success("Vehicle added", { description: `${normalizePlate(plate)} · ${model!.name}` });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error & { code?: string }) => setErr(e.code === "23505" ? "This plate is already in your fleet." : e.message),
  });

  const pick = (v: Vehicle) => { setCustom(false); setModel(v); setQ(v.name); setTimeout(() => plateRef.current?.focus(), 0); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add vehicle</DialogTitle>
          <DialogDescription>Search the model, pick it, then type the number plate.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!model) return setErr("Pick a model from the list.");
            if (normalizePlate(plate).length < 4) { setErr("Enter the number plate."); plateRef.current?.focus(); return; }
            setErr("");
            add.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="model-search">Model</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="model-search" autoFocus autoComplete="off" spellCheck={false} placeholder="e.g. dokker, kangoo, sprinter" className="pl-9 text-base" value={q}
                onChange={(e) => { setQ(e.target.value); setModel(null); setCustom(false); }} />
            </div>
            {!model && (
              <ul role="listbox" aria-label="Matching models" className="max-h-60 overflow-y-auto overscroll-contain rounded-lg border border-border">
                {results.length ? results.map((v) => (
                  <li key={v.id}>
                    <button type="button" onClick={() => pick(v)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                      <span className="min-w-0"><span className="font-medium" translate="no">{v.name}</span><span className="block text-xs text-muted-foreground">{v.kind} · {v.fuel === "diesel" ? "Diesel" : "Petrol"}</span></span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{v.fuelPer100km} L/100 km · {v.capacityParcels} parcels</span>
                    </button>
                  </li>
                )) : <li className="px-3 py-3 text-sm text-muted-foreground">Not in the list yet.</li>}
                {q.trim().length >= 2 && (
                  <li className="border-t border-border">
                    <button type="button" disabled={find.isPending} onClick={() => find.mutate()} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-60">
                      <Sparkles className="size-4 shrink-0" aria-hidden />
                      {find.isPending ? "Looking up specs…" : <>Look up specs for “{q.trim()}”</>}
                    </button>
                  </li>
                )}
              </ul>
            )}
            {model && custom && <p className="text-xs text-muted-foreground">Specs found automatically: <span translate="no">{model.kind}</span>. Typical figures — check them if you know your van's exact numbers.</p>}
            {model && (
              <div className="flex flex-wrap gap-1.5 text-[11px] tabular-nums text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5">{model.fuel === "diesel" ? "Diesel" : "Petrol"} · {model.fuelPer100km} L/100 km</span>
                <span className="rounded bg-muted px-1.5 py-0.5">{n0.format(co2PerKm(model) * 1000)} g CO₂/km</span>
                <span className="rounded bg-muted px-1.5 py-0.5">{model.capacityParcels} parcels · {n0.format(model.payloadKg)} kg</span>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plate">Number plate</Label>
            <Input id="plate" ref={plateRef} name="plate" autoComplete="off" spellCheck={false} placeholder="C AB 123" className="text-base uppercase" value={plate} onChange={(e) => setPlate(e.target.value)} />
          </div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <DialogFooter>
            <Button type="submit" disabled={add.isPending}>{add.isPending ? "Adding…" : "Add vehicle"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
