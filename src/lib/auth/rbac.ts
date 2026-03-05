import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getReviewEmail, getReviewUserId, isLocalBypassMode, resolveReviewAccountId } from "@/lib/services/review-mode";
import type { AccountRole } from "@/types/domain";

export async function getCurrentUserContext() {
  if (isLocalBypassMode()) {
    const accountId = await resolveReviewAccountId();
    return {
      userId: getReviewUserId(),
      email: getReviewEmail(),
      accountId,
      role: "ACCOUNT_OWNER" as AccountRole,
      supabase: getSupabaseAdminClient()
    };
  }

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
    email: user.email || null,
    accountId: membership.account_id as string,
    role: membership.role as AccountRole,
    supabase
  };
}

export function assertRole(current: AccountRole, allowed: AccountRole[]) {
  if (!allowed.includes(current)) throw new Error("Insufficient role");
}
