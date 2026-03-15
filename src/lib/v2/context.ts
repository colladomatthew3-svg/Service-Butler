import { getCurrentUserContext } from "@/lib/auth/rbac";
import { isDemoMode } from "@/lib/services/review-mode";
import type { V2TenantContext } from "@/lib/v2/types";

export async function getV2TenantContext(): Promise<
  (V2TenantContext & {
    supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"];
  }) | null
> {
  if (isDemoMode()) return null;

  const base = await getCurrentUserContext();
  const { accountId, userId, role, supabase } = base;

  const { data: mapping, error } = await supabase
    .from("v2_account_tenant_map")
    .select("enterprise_tenant_id,franchise_tenant_id")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error || !mapping?.enterprise_tenant_id || !mapping?.franchise_tenant_id) {
    throw new Error("V2 tenant mapping not found for current account");
  }

  return {
    accountId,
    userId,
    role,
    franchiseTenantId: String(mapping.franchise_tenant_id),
    enterpriseTenantId: String(mapping.enterprise_tenant_id),
    supabase
  };
}
