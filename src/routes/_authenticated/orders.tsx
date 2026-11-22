import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STATUS_LABEL, isoDay, type OrderRow, type OrderStatus } from "@/lib/orders";
import { query as geocode } from "@/lib/geocode";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Orders — GreenLogix" },
      { name: "description", content: "Incoming delivery orders for Chișinău, updated live as they arrive." },
      { property: "og:title", content: "Orders — GreenLogix" },
      { property: "og:description", content: "Incoming delivery orders, updated live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function OrdersPage() {
  const qc = useQueryClient();
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as OrderRow[];
    },
    refetchInterval: 5000, // new orders show up on their own
  });

  // Announce orders that arrived since the last check.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!orders.data) return;
    const ids = new Set(orders.data.map((o) => o.id));
    if (seen.current) {
      const fresh = orders.data.filter((o) => !seen.current!.has(o.id));
      if (fresh.length) toast.success(fresh.length === 1 ? `New order: ${fresh[0]!.client_name}` : `${fresh.length} new orders`);
    }
    seen.current = ids;
  }, [orders.data]);

  const [open, setOpen] = useState(false);
  const rows = orders.data ?? [];

  return (
    <div className="min-h-dvh bg-background font-sans text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold [text-wrap:balance]">Orders</h1>
            <p className="text-sm text-muted-foreground">New orders appear here automatically · {rows.length} {rows.length === 1 ? "order" : "orders"}</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus aria-hidden /> New order</Button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Client</th><th className="px-4 py-3">Address</th><th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Window</th><th className="px-4 py-3">Parcels</th><th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.isLoading && <tr><td colSpan={6} className="px-4 py-6 text-muted-foreground">Loading orders…</td></tr>}
              {orders.isError && <tr><td colSpan={6} className="px-4 py-6 text-destructive">Couldn't load orders.</td></tr>}
              {orders.isSuccess && !rows.length && <tr><td colSpan={6} className="px-4 py-6 text-muted-foreground">No orders yet. They'll show up here as soon as one comes in.</td></tr>}
              {rows.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="min-w-0 px-4 py-3">
                    <span className="font-medium">{o.client_name}</span>
                    {o.priority === "high" && <span className="ml-2 rounded bg-urgent px-1.5 py-0.5 text-xs font-medium text-white">Urgent</span>}
                    <div className="text-xs capitalize text-muted-foreground">{o.client_type}</div>
                  </td>
                  <td className="px-4 py-3 [overflow-wrap:anywhere]">{o.address}<div className="text-xs text-muted-foreground">{o.district}</div></td>
                  <td className="px-4 py-3 tabular-nums">{day.format(new Date(o.delivery_date + "T00:00"))}</td>
                  <td className="px-4 py-3 tabular-nums">{o.time_window || "Any time"}</td>
                  <td className="px-4 py-3 tabular-nums">{o.parcels}</td>
                  <td className="px-4 py-3">{STATUS_LABEL[o.status as OrderStatus] ?? o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <NewOrder open={open} onOpenChange={setOpen} onDone={() => qc.invalidateQueries({ queryKey: ["orders"] })} />
    </div>
  );
}

function NewOrder({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [f, setF] = useState({ client: "", type: "retail", address: "", district: "", priority: "normal", parcels: "1", window: "", date: isoDay(1) });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const add = useMutation({
    mutationFn: async () => {
      const ll = await geocode(`${f.address}, Chișinău, Moldova`).catch(() => null);
      const { error } = await supabase.from("orders").insert({
        client_name: f.client.trim(), client_type: f.type, address: f.address.trim(), district: f.district.trim() || "—",
        priority: f.priority, parcels: Math.max(1, Number(f.parcels) || 1), time_window: f.window.trim(), delivery_date: f.date,
        lat: ll?.[0] ?? null, lng: ll?.[1] ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { onDone(); onOpenChange(false); setF({ ...f, client: "", address: "", district: "", window: "" }); },
    onError: (e: Error) => toast.error("Couldn't add order", { description: e.message }),
  });
  const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-base";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New order</DialogTitle>
          <DialogDescription>It appears in the list right away and can be planned on the Plan page.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (f.client.trim() && f.address.trim()) add.mutate(); }}>
          <div className="sm:col-span-2"><Label htmlFor="o-client">Client</Label><Input id="o-client" name="organization" autoComplete="organization" required value={f.client} onChange={set("client")} /></div>
          <div className="sm:col-span-2"><Label htmlFor="o-addr">Address</Label><Input id="o-addr" name="street-address" autoComplete="street-address" required value={f.address} onChange={set("address")} placeholder="bd. Ștefan cel Mare 1" /></div>
          <div><Label htmlFor="o-dist">District</Label><Input id="o-dist" value={f.district} onChange={set("district")} placeholder="Centru" /></div>
          <div><Label htmlFor="o-type">Client type</Label><select id="o-type" className={sel} value={f.type} onChange={set("type")}><option value="horeca">HoReCa</option><option value="retail">Retail</option><option value="ecommerce">E-commerce</option></select></div>
          <div><Label htmlFor="o-pri">Priority</Label><select id="o-pri" className={sel} value={f.priority} onChange={set("priority")}><option value="normal">Normal</option><option value="high">Urgent</option></select></div>
          <div><Label htmlFor="o-parcels">Parcels</Label><Input id="o-parcels" type="number" inputMode="numeric" min={1} value={f.parcels} onChange={set("parcels")} /></div>
          <div><Label htmlFor="o-win">Time window</Label><Input id="o-win" value={f.window} onChange={set("window")} placeholder="09:00-12:00" /></div>
          <div><Label htmlFor="o-date">Delivery date</Label><Input id="o-date" type="date" value={f.date} onChange={set("date")} /></div>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={add.isPending}>{add.isPending ? "Adding…" : "Add order"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
