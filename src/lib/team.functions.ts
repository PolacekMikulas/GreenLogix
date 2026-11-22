import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface InviteInput {
  email: string;
  fullName: string;
  phone: string;
  role: "driver" | "dispatcher";
  redirectTo: string;
}

/** Dispatcher-only: email an invite, create the account, and give it a role. */
export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: InviteInput) => {
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Enter a valid email address");
    const fullName = String(input.fullName ?? "").trim().slice(0, 100);
    if (!fullName) throw new Error("Enter the person's name");
    const role = input.role === "dispatcher" ? "dispatcher" : "driver";
    const redirectTo = new URL(String(input.redirectTo)).toString();
    return { email, fullName, phone: String(input.phone ?? "").trim().slice(0, 30), role, redirectTo } as const;
  })
  .handler(async ({ data, context }) => {
    const { data: isDispatcher } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "dispatcher" });
    if (!isDispatcher) throw new Error("Only dispatchers can invite people");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirectTo,
      data: { full_name: data.fullName },
    });
    if (error || !invited.user) throw new Error(error?.message.includes("already") ? "This email already has an account" : (error?.message ?? "Invite failed"));

    const id = invited.user.id;
    await supabaseAdmin.from("profiles").upsert({ id, email: data.email, full_name: data.fullName, phone: data.phone });
    await supabaseAdmin.from("user_roles").upsert({ user_id: id, role: data.role }, { onConflict: "user_id,role" });
    return { id };
  });
