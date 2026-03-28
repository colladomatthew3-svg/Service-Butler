"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const feature_flags_1 = require("@/lib/config/feature-flags");
const context_1 = require("@/lib/v2/context");
const review_mode_1 = require("@/lib/services/review-mode");
async function GET(req) {
    if ((0, review_mode_1.isDemoMode)() || !feature_flags_1.featureFlags.useV2Reads) {
        return server_1.NextResponse.json({ territories: [], mode: "compat" });
    }
    const context = await (0, context_1.getV2TenantContext)();
    if (!context)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const active = req.nextUrl.searchParams.get("active");
    let query = context.supabase
        .from("v2_territories")
        .select("id,external_id,name,zip_codes,service_lines,active,capacity_json,hours_json,created_at,updated_at")
        .eq("tenant_id", context.franchiseTenantId)
        .order("name", { ascending: true })
        .limit(200);
    if (active === "true")
        query = query.eq("active", true);
    if (active === "false")
        query = query.eq("active", false);
    const { data, error } = await query;
    if (error)
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    return server_1.NextResponse.json({ territories: data || [] });
}
async function POST(req) {
    if ((0, review_mode_1.isDemoMode)() || !feature_flags_1.featureFlags.useV2Writes) {
        return server_1.NextResponse.json({ ok: false, mode: "compat", reason: "Enable SB_USE_V2_WRITES for v2 territories" }, { status: 202 });
    }
    const context = await (0, context_1.getV2TenantContext)();
    if (!context)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    (0, rbac_1.assertRole)(context.role, ["ACCOUNT_OWNER", "DISPATCHER"]);
    const body = (await req.json().catch(() => ({})));
    const name = String(body.name || "").trim();
    if (!name)
        return server_1.NextResponse.json({ error: "name is required" }, { status: 400 });
    const payload = {
        tenant_id: context.franchiseTenantId,
        external_id: body.externalId ? String(body.externalId).trim() : null,
        name,
        zip_codes: Array.isArray(body.zipCodes) ? body.zipCodes.map((zip) => String(zip).trim()).filter(Boolean) : [],
        service_lines: Array.isArray(body.serviceLines) ? body.serviceLines.map((line) => String(line).trim()).filter(Boolean) : [],
        active: body.active !== false,
        capacity_json: body.capacity || {},
        hours_json: body.hours || {}
    };
    const { data, error } = await context.supabase
        .from("v2_territories")
        .insert(payload)
        .select("id,external_id,name,zip_codes,service_lines,active,capacity_json,hours_json,created_at,updated_at")
        .single();
    if (error)
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    return server_1.NextResponse.json({ territory: data }, { status: 201 });
}
