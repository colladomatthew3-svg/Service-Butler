import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountRole } from "@/types/domain";

export async function getCurrentUserContext() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Unauthorized");

  const { data: membership, error } = await supabase
    .from("account_roles")
    .select("account_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (error || !membership) throw new Error("No active account membership");

  return {
    userId: user.id,
    accountId: membership.account_id as string,
    role: membership.role as AccountRole,
    supabase
  };
}

export function assertRole(current: AccountRole, allowed: AccountRole[]) {
  if (!allowed.includes(current)) throw new Error("Insufficient role");
}
