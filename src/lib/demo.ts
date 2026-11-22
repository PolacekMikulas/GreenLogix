import { supabase } from "@/integrations/supabase/client";
import { DEMO_EMAIL, DEMO_PASSWORD, ensureDemoUser } from "./demo.functions";

let pending: Promise<void> | null = null;
/** Demo mode: silently sign in as the demo dispatcher when nobody is signed in. */
export function demoSignIn(): Promise<void> {
  pending ??= (async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) return;
    let r = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    if (r.error) {
      await ensureDemoUser();
      r = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    }
  })().finally(() => { pending = null; });
  return pending;
}
