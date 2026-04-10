import { getCurrentUserContext } from "@/lib/auth/rbac";
import { isDemoMode, isLocalBypassMode } from "@/lib/services/review-mode";
import type { V2ResolvedOwnerUser, V2TenantContext } from "@/lib/v2/types";

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

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function membershipRank(role: string) {
  switch (role) {
    case "FRANCHISE_OWNER":
      return 0;
    case "DISPATCHER":
      return 1;
    case "TECH":
      return 2;
    default:
      return 99;
  }
}

function accountRoleRank(role: string) {
  switch (role) {
    case "ACCOUNT_OWNER":
      return 0;
    case "DISPATCHER":
      return 1;
    case "TECH":
      return 2;
    default:
      return 99;
  }
}

export async function resolveV2OwnerUserForTenant(input: {
  supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"];
  accountId: string;
  userId: string;
  franchiseTenantId: string;
}): Promise<V2ResolvedOwnerUser | null> {
  const normalizedUserId = asText(input.userId);
  const normalizedAccountId = asText(input.accountId);
  const normalizedTenantId = asText(input.franchiseTenantId);

  if (!normalizedUserId || !normalizedAccountId || !normalizedTenantId) return null;

  const [{ data: accountRole }, { data: membership }] = await Promise.all([
    input.supabase
      .from("account_roles")
      .select("user_id")
      .eq("account_id", normalizedAccountId)
      .eq("user_id", normalizedUserId)
      .eq("is_active", true)
      .maybeSingle(),
    input.supabase
      .from("v2_tenant_memberships")
      .select("user_id")
      .eq("tenant_id", normalizedTenantId)
      .eq("user_id", normalizedUserId)
      .eq("is_active", true)
      .maybeSingle()
  ]);

  if (accountRole?.user_id && membership?.user_id) {
    return {
      ownerUserId: normalizedUserId,
      resolutionSource: "authenticated_user"
    };
  }

  if (!isLocalBypassMode()) return null;

  const [{ data: accountRoles, error: accountRolesError }, { data: memberships, error: membershipsError }] = await Promise.all([
    input.supabase
      .from("account_roles")
      .select("user_id,role,created_at")
      .eq("account_id", normalizedAccountId)
      .eq("is_active", true)
      .in("role", ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]),
    input.supabase
      .from("v2_tenant_memberships")
      .select("user_id,role,created_at")
      .eq("tenant_id", normalizedTenantId)
      .eq("is_active", true)
      .in("role", ["FRANCHISE_OWNER", "DISPATCHER", "TECH"])
  ]);

  if (accountRolesError || membershipsError || !accountRoles?.length || !memberships?.length) {
    return null;
  }

  const membershipByUser = new Map(
    memberships
      .map((row) => ({
        userId: asText(row.user_id),
        role: asText(row.role),
        createdAt: asText(row.created_at)
      }))
      .filter((row) => row.userId)
      .map((row) => [row.userId, row])
  );

  const candidate = accountRoles
    .map((row) => {
      const userId = asText(row.user_id);
      const tenantMembership = membershipByUser.get(userId);
      if (!userId || !tenantMembership) return null;
      return {
        userId,
        accountRole: asText(row.role),
        accountCreatedAt: asText(row.created_at),
        membershipRole: tenantMembership.role,
        membershipCreatedAt: tenantMembership.createdAt
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const roleDelta = Math.min(accountRoleRank(left!.accountRole), membershipRank(left!.membershipRole)) - Math.min(accountRoleRank(right!.accountRole), membershipRank(right!.membershipRole));
      if (roleDelta !== 0) return roleDelta;
      const leftCreated = Date.parse(left!.membershipCreatedAt || left!.accountCreatedAt || "");
      const rightCreated = Date.parse(right!.membershipCreatedAt || right!.accountCreatedAt || "");
      return (Number.isFinite(leftCreated) ? leftCreated : Number.MAX_SAFE_INTEGER) - (Number.isFinite(rightCreated) ? rightCreated : Number.MAX_SAFE_INTEGER);
    })[0];

  if (!candidate?.userId) return null;

  return {
    ownerUserId: candidate.userId,
    resolutionSource: "tenant_operator_fallback"
  };
}
