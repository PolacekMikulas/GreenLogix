import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — GreenLogix" },
      { name: "description", content: "Theme, language, text size and account settings for GreenLogix." },
      { property: "og:title", content: "Settings — GreenLogix" },
      { property: "og:description", content: "Personalise GreenLogix: theme, language and text size." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function Choice<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-muted p-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
          className={cn("min-h-9 rounded-md px-3 text-sm", value === v ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b py-4 last:border-0">
      <div className="min-w-0"><p className="font-medium">{title}</p>{hint && <p className="text-sm text-muted-foreground">{hint}</p>}</div>
      {children}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="rounded-xl border bg-card px-6 py-1">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const t = useT();
  const [p, setP] = useState<Prefs>(DEFAULT_PREFS);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [uid, setUid] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setP(loadPrefs());
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setEmail(data.user.email ?? ""); setUid(data.user.id);
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
      setName(prof?.full_name ?? "");
    });
  }, []);

  const [scale, setScale] = useState(100);
  const [draft, setDraft] = useState("100");
  useEffect(() => { setScale(p.textScale); setDraft(String(p.textScale)); }, [p.textScale]);
  const setSize = (v: number) => {
    const n = Math.min(150, Math.max(80, Math.round(Number.isFinite(v) ? v : 100)));
    setScale(n); setDraft(String(n)); set({ textScale: n });
  };
  const set = (patch: Partial<Prefs>) => { const n = { ...p, ...patch }; setP(n); savePrefs(n); };

  async function saveName() {
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", uid);
    if (error) toast.error(t("Couldn't save your name")); else toast.success(t("Profile saved"));
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <h1 className="font-display text-2xl font-bold">{t("Settings")}</h1>

        <Group title={t("Appearance")}>
          <Row title={t("Theme")} hint={t("Follow your device, or pick light or dark.")}>
            <Choice value={p.theme} onChange={(theme) => set({ theme })} options={[["system", t("System")], ["light", t("Light")], ["dark", t("Dark")]]} />
          </Row>
        </Group>

        <Group title={t("Language")}>
          <Row title={t("Interface language")}>
            <Choice value={p.lang} onChange={(lang) => set({ lang })} options={[["en", "English"], ["ro", "Română"], ["ru", "Русский"]]} />
          </Row>
        </Group>

        <Group title={t("Accessibility")}>
          <div className="space-y-3 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><p className="font-medium">{t("Text size")}</p><p className="text-sm text-muted-foreground">{t("Drag to make all text smaller or bigger.")}</p></div>
              <div className="flex items-center gap-1">
                <Input aria-label={t("Text size")} type="number" inputMode="numeric" min={80} max={150} className="w-20 text-center text-base tabular-nums" value={draft}
                  onChange={(e) => setDraft(e.target.value)} onBlur={() => setSize(Number(draft))} onKeyDown={(e) => e.key === "Enter" && setSize(Number(draft))} />
                <span className="text-sm">%</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs" aria-hidden="true">A</span>
              <Slider aria-label={t("Text size")} min={80} max={150} step={1} value={[scale]} onValueChange={([v]) => { setScale(v ?? 100); setDraft(String(v ?? 100)); }} onValueCommit={([v]) => setSize(v ?? 100)} />
              <span className="text-lg" aria-hidden="true">A</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSize(100)}>{t("Reset")}</Button>
            </div>
          </div>
        </Group>

        <Group title={t("Account")}>
          <Row title={t("Email")}><span className="min-w-0 text-sm [overflow-wrap:anywhere]">{email || "…"}</span></Row>
          <div className="space-y-2 border-b py-4">
            <Label htmlFor="name">{t("Your name")}</Label>
            <div className="flex gap-2"><Input id="name" name="name" autoComplete="name" className="text-base" value={name} onChange={(e) => setName(e.target.value)} /><Button type="button" onClick={saveName}>{t("Save")}</Button></div>
          </div>
          <Row title={t("Sign out")} hint={t("You'll need to sign in again on this device.")}>
            <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", search: { redirect: "/" } }); }}>{t("Sign out")}</Button>
          </Row>
        </Group>
      </main>
    </div>
  );
}
