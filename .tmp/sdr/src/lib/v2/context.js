"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getV2TenantContext = getV2TenantContext;
const rbac_1 = require("@/lib/auth/rbac");
const review_mode_1 = require("@/lib/services/review-mode");
function toTenantResolution(row) {
    const franchiseTenantId = String(row.id);
    const enterpriseTenantId = row.parent_tenant_id ? String(row.parent_tenant_id) : franchiseTenantId;
    return { franchiseTenantId, enterpriseTenantId };
}
async function resolveFromLegacyAccount({ supabase, accountId }) {
    const { data, error } = await supabase
        .from("v2_tenants")
        .select("id,parent_tenant_id")
        .eq("legacy_account_id", accountId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
    if (error || !data?.id)
        return null;
    return toTenantResolution({
        id: String(data.id),
        parent_tenant_id: data.parent_tenant_id ? String(data.parent_tenant_id) : null
    });
}
async function resolveFromMembership({ supabase, userId }) {
    const { data: memberships, error: membershipError } = await supabase
        .from("v2_tenant_memberships")
        .select("tenant_id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(25);
    if (membershipError || !memberships?.length)
        return null;
    const tenantIds = memberships
        .map((row) => String(row.tenant_id || "").trim())
        .filter(Boolean);
    if (tenantIds.length === 0)
        return null;
    const { data: tenants, error: tenantError } = await supabase
        .from("v2_tenants")
        .select("id,parent_tenant_id,type")
        .in("id", tenantIds);
    if (tenantError || !tenants?.length)
        return null;
    const preferred = tenants.find((row) => row.type === "franchise") ||
        tenants.find((row) => row.type === "enterprise") ||
        tenants[0];
    if (!preferred?.id)
        return null;
    return toTenantResolution({
        id: String(preferred.id),
        parent_tenant_id: preferred.parent_tenant_id ? String(preferred.parent_tenant_id) : null
    });
}
async function getV2TenantContext() {
    if ((0, review_mode_1.isDemoMode)())
        return null;
    const base = await (0, rbac_1.getCurrentUserContext)();
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
    return {
        accountId,
        userId,
        role,
        franchiseTenantId,
        enterpriseTenantId,
        supabase
    };
}
