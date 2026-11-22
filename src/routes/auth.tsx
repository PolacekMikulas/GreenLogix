import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { demoSignIn } from "@/lib/demo";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const safePath = (p: unknown) => (typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : "/drivers");

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: safePath(s["redirect"]) }),
  head: () => ({
    meta: [
      { title: "Sign in — GreenLogix" },
      { name: "description", content: "Sign in to GreenLogix to manage your courier team and runs." },
      { property: "og:title", content: "Sign in — GreenLogix" },
      { property: "og:description", content: "Sign in to manage your courier team and runs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const input = "h-11 w-full rounded-md border border-input bg-background px-3 text-base";

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    demoSignIn().then(() => supabase.auth.getUser()).then(({ data }) => data.user && navigate({ to: redirect, replace: true }));
  }, [navigate, redirect]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error("Couldn't sign in", { description: error.message }); return; }
      navigate({ to: redirect, replace: true });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/drivers", data: { full_name: String(f.get("name")) } },
      });
      setBusy(false);
      if (error) { toast.error("Couldn't create the account", { description: error.message }); return; }
      toast.success("Check your email", { description: "Open the link we sent to confirm your account." });
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Google sign-in failed", { description: String(r.error.message ?? r.error) });
    else if (!r.redirected) navigate({ to: redirect, replace: true });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-5 rounded-[14px] border border-border bg-card p-6">
        <div>
          <p className="font-display text-xl font-bold">Green<span className="text-primary">Logix</span></p>
          <h1 className="mt-2 text-lg font-semibold">{mode === "in" ? "Sign in" : "Create a dispatcher account"}</h1>
          {mode === "up" && <p className="text-sm text-muted-foreground">Drivers don't sign up here — a dispatcher invites them by email.</p>}
        </div>
        <button type="button" onClick={google} className="flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F]">
          <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
          Continue with Google
        </button>
        <form className="space-y-3" onSubmit={submit}>
          {mode === "up" && (
            <div className="space-y-1.5"><Label htmlFor="name">Your name</Label><input id="name" name="name" autoComplete="name" required className={input} /></div>
          )}
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><input id="email" name="email" type="email" autoComplete="email" spellCheck={false} required className={input} /></div>
          <div className="space-y-1.5"><Label htmlFor="password">Password</Label><input id="password" name="password" type="password" minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} required className={input} /></div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? (mode === "in" ? "Signing in…" : "Creating…") : mode === "in" ? "Sign in" : "Create account"}</Button>
        </form>
        <button type="button" className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "New company? Create a dispatcher account" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
