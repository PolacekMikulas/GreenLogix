import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

type Info = { email: string; name: string; role: string; since: string };

function initials(s: string) {
  const parts = s.trim().split(/[\s@._-]+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => Array.from(p)[0] ?? "");
  return chars.join("").toUpperCase() || "?";
}

export function UserMenu() {
  const t = useT();
  const navigate = useNavigate();
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u) return;
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", u.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.id),
      ]);
      setInfo({
        email: u.email ?? "",
        name: prof?.full_name ?? "",
        role: roles?.[0]?.role ?? "",
        since: u.created_at ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(u.created_at)) : "",
      });
    });
  }, []);

  if (!info) {
    return (
      <Link to="/auth" search={{ redirect: "/" }} className="rounded-lg px-3 py-2 text-sm text-white/80 hover:text-white">
        {t("Sign in")}
      </Link>
    );
  }

  const label = info.name || info.email;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button aria-label={t("Account")} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime font-semibold text-header transition-transform duration-150 active:scale-[0.97]">
          {initials(label)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">{initials(label)}</div>
          <div className="min-w-0">
            <p className="line-clamp-2 font-medium" title={info.name}>{info.name || t("No name yet")}</p>
            <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{info.email}</p>
          </div>
        </div>
        <dl className="mt-4 space-y-1 text-sm">
          {info.role && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("Role")}</dt><dd className="capitalize">{info.role}</dd></div>}
          {info.since && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("Member since")}</dt><dd>{info.since}</dd></div>}
        </dl>
        <div className="mt-4 flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1"><Link to="/settings">{t("Settings")}</Link></Button>
          <Button size="sm" variant="secondary" className="flex-1" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", search: { redirect: "/" } }); }}>{t("Sign out")}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
