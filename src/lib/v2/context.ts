import { getCurrentUserContext } from "@/lib/auth/rbac";
import { isDemoMode } from "@/lib/services/review-mode";
import type { V2TenantContext } from "@/lib/v2/types";

type TenantResolution = {
  franchiseTenantId: string;
  enterpriseTenantId: string;
};

function toTenantResolution(row: { id: string; parent_tenant_id?: string | null }): TenantResolution {
  const franchiseTenantId = String(row.id);
  const enterpriseTenantId = row.parent_tenant_id ? String(row.parent_tenant_id) : franchiseTenantId;
  return { franchiseTenantId, enterpriseTenantId };
}

async function resolveFromLegacyAccount({
  supabase,
  accountId
}: {
  supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"];
  accountId: string;
}): Promise<TenantResolution | null> {
  const { data, error } = await supabase
    .from("v2_tenants")
    .select("id,parent_tenant_id")
    .eq("legacy_account_id", accountId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return null;
  return toTenantResolution({
    id: String(data.id),
    parent_tenant_id: data.parent_tenant_id ? String(data.parent_tenant_id) : null
  });
}

async function resolveFromMembership({
  supabase,
  userId
}: {
  supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"];
  userId: string;
}): Promise<TenantResolution | null> {
  const { data: memberships, error: membershipError } = await supabase
    .from("v2_tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(25);

  if (membershipError || !memberships?.length) return null;

  const tenantIds = memberships
    .map((row) => String(row.tenant_id || "").trim())
    .filter(Boolean);

  if (tenantIds.length === 0) return null;

  const { data: tenants, error: tenantError } = await supabase
    .from("v2_tenants")
    .select("id,parent_tenant_id,type")
    .in("id", tenantIds);

  if (tenantError || !tenants?.length) return null;

  const preferred =
    tenants.find((row) => row.type === "franchise") ||
    tenants.find((row) => row.type === "enterprise") ||
    tenants[0];

  if (!preferred?.id) return null;

  return toTenantResolution({
    id: String(preferred.id),
    parent_tenant_id: preferred.parent_tenant_id ? String(preferred.parent_tenant_id) : null
  });
}

export async function getV2TenantContext(): Promise<
  (V2TenantContext & {
    supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"];
  }) | null
> {
  if (isDemoMode()) return null;

  const base = await getCurrentUserContext();
  const { accountId, userId, role, supabase } = base;

  const { data: mapping } = await supabase
    .from("v2_account_tenant_map")
    .select("enterprise_tenant_id,franchise_tenant_id")
    .eq("account_id", accountId)
    .maybeSingle();


  let franchiseTenantId = mapping?.franchise_tenant_id ? String(mapping.franchise_tenant_id) : "";
  let enterpriseTenantId = mapping?.enterprise_tenant_id ? String(mapping.enterprise_tenant_id) : "";

  if (!franchiseTenantId || !enterpriseTenantId) {
    const legacy = await resolveFromLegacyAccount({ supabase, accountId });
    if (legacy) {
      franchiseTenantId = legacy.franchiseTenantId;
      enterpriseTenantId = legacy.enterpriseTenantId;
    }
  }

  if (!franchiseTenantId || !enterpriseTenantId) {
    const membership = await resolveFromMembership({ supabase, userId });
    if (membership) {
      franchiseTenantId = membership.franchiseTenantId;
      enterpriseTenantId = membership.enterpriseTenantId;
    }
  }

  if (!franchiseTenantId || !enterpriseTenantId) {
    throw new Error("V2 tenant mapping not found for current account");
  }

  // Read franchise vertical from tenant settings_json
  let franchiseVertical: string | null = null;
  const { data: tenantRow } = await supabase
    .from("v2_tenants")
    .select("settings_json")
    .eq("id", franchiseTenantId)
    .maybeSingle();
  if (tenantRow?.settings_json && typeof tenantRow.settings_json === "object") {
    const settings = tenantRow.settings_json as Record<string, unknown>;
    if (typeof settings.vertical === "string" && settings.vertical) {
      franchiseVertical = settings.vertical;
    }
  }

  return {
    accountId,
    userId,
    role,
    franchiseTenantId,
    enterpriseTenantId,
    franchiseVertical,
    supabase
  };
}
