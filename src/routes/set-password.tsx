import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/set-password")({
  head: () => ({
    meta: [
      { title: "Set your password — GreenLogix" },
      { name: "description", content: "Finish setting up your GreenLogix account." },
      { property: "og:title", content: "Set your password — GreenLogix" },
      { property: "og:description", content: "Finish setting up your GreenLogix account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetPassword,
});

function SetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => s && setReady(true));
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session || null));
    const t = setTimeout(() => setReady((r) => r ?? false), 4000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error("Couldn't save the password", { description: error.message }); return; }
    toast.success("You're all set");
    navigate({ to: "/drivers", replace: true });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-4 rounded-[14px] border border-border bg-card p-6">
        <p className="font-display text-xl font-bold">Green<span className="text-primary">Logix</span></p>
        {ready === false ? (
          <p className="text-sm text-muted-foreground">This invite link has expired or was already used. Ask your dispatcher to send a new one.</p>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Choose a password</h1>
            <p className="text-sm text-muted-foreground">You'll use it with your email to sign in next time.</p>
            <form className="space-y-3" onSubmit={submit}>
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required className="h-11 w-full rounded-md border border-input bg-background px-3 text-base" />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={busy || !ready}>{busy ? "Saving…" : "Save and continue"}</Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
