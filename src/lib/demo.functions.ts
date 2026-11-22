import { createServerFn } from "@tanstack/react-start";

export const DEMO_EMAIL = "demo.dispatcher@greenlogix.app";
// Jury demo account: public on purpose, dispatcher role only.
export const DEMO_PASSWORD = "GreenLogix-Demo-2026!";

/** Makes sure the shared demo dispatcher exists. Public: it only ever creates this one account. */
export const ensureDemoUser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let id: string | undefined;
  const { data: created } = await supabaseAdmin.auth.admin.createUser({
    email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { full_name: "Demo Dispatcher" },
  });
  id = created?.user?.id;
  if (!id) {
    const { data } = await supabaseAdmin.from("profiles").select("id").eq("email", DEMO_EMAIL).maybeSingle();
    id = data?.id;
  }
  if (!id) return { ok: false };
  await supabaseAdmin.from("profiles").upsert({ id, email: DEMO_EMAIL, full_name: "Demo Dispatcher" });
  await supabaseAdmin.from("user_roles").upsert({ user_id: id, role: "dispatcher" }, { onConflict: "user_id,role" });
  await supabaseAdmin.from("user_roles").delete().eq("user_id", id).eq("role", "driver");
  return { ok: true };
});
