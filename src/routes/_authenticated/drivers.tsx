import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LogOut, MapPin, MapPinOff, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { inviteMember } from "@/lib/team.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DriversMap = lazy(() => import("@/components/DriversMap"));

export const Route = createFileRoute("/_authenticated/drivers")({
  head: () => ({
    meta: [
      { title: "Team — GreenLogix" },
      { name: "description", content: "Invite drivers by email and see who's active, where they are and how their run is going." },
      { property: "og:title", content: "Team — GreenLogix" },
      { property: "og:description", content: "Invite drivers and follow their runs live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriversPage,
});

const ago = (iso: string | null) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
};

function useMe() {
  const { user } = Route.useRouteContext();
  return useQuery({
    queryKey: ["me", user.id],
    queryFn: async () => {
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      ]);
      return { id: user.id, email: user.email ?? "", roles: (roles ?? []).map((r) => r.role), profile };
    },
  });
}

function DriversPage() {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: "/drivers" }, replace: true });
  };
  const right = (
    <Button variant="ghost" size="sm" className="text-white/80 hover:text-white" onClick={signOut}>
      <LogOut aria-hidden /> Sign out
    </Button>
  );
  return (
    <div className="min-h-dvh bg-background font-sans text-foreground">
      <AppHeader right={right} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        {me.isLoading ? (
          <div className="h-64 animate-pulse rounded-[14px] bg-muted" />
        ) : me.data?.roles.includes("dispatcher") ? (
          <TeamView />
        ) : me.data ? (
          <DriverProfile id={me.data.id} email={me.data.email} name={me.data.profile?.full_name ?? ""} isDriver={me.data.roles.includes("driver")} />
        ) : null}
      </main>
    </div>
  );
}

type Member = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  activated_at: string | null;
  role: "dispatcher" | "driver" | null;
  status: { lat: number | null; lng: number | null; location_at: string | null; stops_done: number; stops_total: number } | null;
};

function TeamView() {
  const qc = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const team = useQuery({
    queryKey: ["team"],
    queryFn: async (): Promise<Member[]> => {
      const [p, r, s] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("driver_status").select("*"),
      ]);
      if (p.error) throw p.error;
      return (p.data ?? []).map((x) => ({
        ...x,
        role: (r.data ?? []).find((y) => y.user_id === x.id && y.role === "dispatcher") ? "dispatcher" : (r.data ?? []).some((y) => y.user_id === x.id) ? "driver" : null,
        status: (s.data ?? []).find((y) => y.user_id === x.id) ?? null,
      }));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`team-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_status" }, () => qc.invalidateQueries({ queryKey: ["team"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => qc.invalidateQueries({ queryKey: ["team"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const drivers = (team.data ?? []).filter((m) => m.role === "driver");
  const dispatchers = (team.data ?? []).filter((m) => m.role === "dispatcher");
  const pins = useMemo(
    () => drivers.filter((d) => d.status?.lat != null && d.status.lng != null).map((d) => ({ id: d.id, name: d.full_name || d.email, lat: d.status!.lat!, lng: d.status!.lng!, at: ago(d.status!.location_at) })),
    [drivers],
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-balance md:text-3xl">Team</h1>
          <p className="text-sm text-muted-foreground">{drivers.length} {drivers.length === 1 ? "driver" : "drivers"} · {dispatchers.length} {dispatchers.length === 1 ? "dispatcher" : "dispatchers"}</p>
        </div>
        <Button onClick={() => setInviting(true)}><UserPlus aria-hidden /> Invite by email</Button>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h2 className="text-sm font-semibold">Where they are now</h2>
          <span className="text-xs text-muted-foreground">{pins.length} of {drivers.length} sharing location</span>
        </div>
        <ClientOnly fallback={<div className="h-[320px] bg-muted md:h-[400px]" />}>
          <Suspense fallback={<div className="h-[320px] bg-muted md:h-[400px]" />}>
            <DriversMap pins={pins} />
          </Suspense>
        </ClientOnly>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Today's progress</th>
              <th className="px-4 py-3 font-medium">Last location</th>
            </tr>
          </thead>
          <tbody>
            {team.isLoading && <tr><td colSpan={5} className="px-4 py-6"><div className="h-8 animate-pulse rounded bg-muted" /></td></tr>}
            {team.data?.length === 1 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No drivers yet. Press “Invite by email” to add your first one.</td></tr>
            )}
            {(team.data ?? []).map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="max-w-[260px] px-4 py-3">
                  <span className="block font-medium [overflow-wrap:anywhere]">{m.full_name || "—"}</span>
                  <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{m.email}{m.phone ? ` · ${m.phone}` : ""}</span>
                </td>
                <td className="px-4 py-3 capitalize">{m.role ?? "—"}</td>
                <td className="px-4 py-3">
                  {m.activated_at ? (
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Active</span>
                  ) : (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Invited · not signed in yet</span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {m.role !== "driver" ? "—" : m.status && m.status.stops_total > 0 ? (
                    <div className="space-y-1">
                      <span>{m.status.stops_done} / {m.status.stops_total} stops</span>
                      <div className="h-1.5 w-28 overflow-hidden rounded bg-muted"><div className="h-full origin-left bg-primary" style={{ transform: `scaleX(${m.status.stops_done / m.status.stops_total})` }} /></div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No run sent yet</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{m.role === "driver" ? (m.status?.location_at ? ago(m.status.location_at) : "Not shared") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InviteDialog open={inviting} onOpenChange={setInviting} onDone={() => qc.invalidateQueries({ queryKey: ["team"] })} />
    </>
  );
}

const field = "h-11 w-full rounded-md border border-input bg-background px-3 text-base";

function InviteDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const invite = useServerFn(inviteMember);
  const [role, setRole] = useState<"driver" | "dispatcher">("driver");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await invite({ data: { email: String(f.get("email")), fullName: String(f.get("name")), phone: String(f.get("phone")), role, redirectTo: window.location.origin + "/set-password" } });
      toast.success("Invite sent", { description: `${f.get("email")} will get an email to set a password.` });
      onDone();
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't send the invite", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>They get an email with a link to choose a password. Their account is created right away.</DialogDescription>
        </DialogHeader>
        <form id="invite" className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5"><Label htmlFor="inv-name">Full name</Label><input id="inv-name" name="name" autoComplete="off" required className={field} /></div>
          <div className="space-y-1.5"><Label htmlFor="inv-email">Email</Label><input id="inv-email" name="email" type="email" autoComplete="off" spellCheck={false} required className={field} /></div>
          <div className="space-y-1.5"><Label htmlFor="inv-phone">Phone (optional)</Label><input id="inv-phone" name="phone" type="tel" inputMode="tel" autoComplete="off" className={field} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "driver" | "dispatcher")}>
              <SelectTrigger id="inv-role" className="h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="driver">Driver</SelectItem>
                <SelectItem value="dispatcher">Dispatcher</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="invite" disabled={busy}>{busy ? "Sending…" : "Send invite"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DriverProfile({ id, email, name, isDriver }: { id: string; email: string; name: string; isDriver: boolean }) {
  const [sharing, setSharing] = useState(false);
  const watch = useRef<number | null>(null);
  const last = useRef(0);

  const stop = () => {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setSharing(false);
  };
  useEffect(() => stop, []);

  const start = () => {
    if (!("geolocation" in navigator)) { toast.error("This phone can't share location"); return; }
    setSharing(true);
    watch.current = navigator.geolocation.watchPosition(
      async (p) => {
        if (Date.now() - last.current < 15000) return;
        last.current = Date.now();
        const { error } = await supabase.from("driver_status").upsert({ user_id: id, lat: p.coords.latitude, lng: p.coords.longitude, accuracy_m: p.coords.accuracy, location_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        if (error) toast.error("Couldn't send your location", { description: error.message });
      },
      (err) => { toast.error("Location is blocked", { description: err.message }); stop(); },
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
  };

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-[14px] border border-border bg-card p-6">
      <h1 className="font-display text-2xl font-bold">{name || "My profile"}</h1>
      <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{email}</p>
      {isDriver ? (
        <>
          <p className="text-sm">Your runs will show up here once the dispatcher sends them.</p>
          <Button className="h-11 w-full" variant={sharing ? "outline" : "default"} onClick={sharing ? stop : start}>
            {sharing ? <><MapPinOff aria-hidden /> Stop sharing location</> : <><MapPin aria-hidden /> Share my location</>}
          </Button>
          <p className="text-xs text-muted-foreground">{sharing ? "Sharing while this page stays open." : "The dispatcher sees where you are only while you share."}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Your account doesn't have a role yet. Ask a dispatcher to invite you.</p>
      )}
    </div>
  );
}
