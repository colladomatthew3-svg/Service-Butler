"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const feature_flags_1 = require("@/lib/config/feature-flags");
const context_1 = require("@/lib/v2/context");
async function GET(req) {
    if (feature_flags_1.featureFlags.useV2Reads) {
        const v2Context = await (0, context_1.getV2TenantContext)().catch(() => null);
        if (v2Context) {
            const category = (req.nextUrl.searchParams.get("category") || "").trim().toLowerCase();
            const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
            const limit = Math.max(1, Math.min(250, Number.isFinite(limitRaw) ? limitRaw : 50));
            let query = v2Context.supabase
                .from("v2_opportunities")
                .select("id,opportunity_type,service_line,title,description,location_text,postal_code,urgency_score,job_likelihood_score,contactability_score,source_reliability_score,revenue_band,catastrophe_linkage_score,routing_status,lifecycle_status,explainability_json,created_at")
                .eq("tenant_id", v2Context.franchiseTenantId)
                .order("created_at", { ascending: false })
                .limit(limit);
            if (category && category !== "all")
                query = query.eq("service_line", category);
            const { data, error } = await query;
            if (error)
                return server_1.NextResponse.json({ error: error.message }, { status: 400 });
            return server_1.NextResponse.json({
                opportunities: (data || []).map((row) => ({
                    id: row.id,
                    category: row.service_line || row.opportunity_type,
                    title: row.title,
                    description: row.description,
                    location_text: row.location_text,
                    city: null,
                    state: null,
                    zip: row.postal_code,
                    territory: null,
                    lat: null,
                    lon: null,
                    intent_score: row.job_likelihood_score,
                    confidence: row.source_reliability_score,
                    urgency_score: row.urgency_score,
                    tags: [],
                    suggested_action: null,
                    recommended_action: null,
                    status: row.lifecycle_status,
                    raw: {
                        revenue_band: row.revenue_band,
                        routing_status: row.routing_status,
                        catastrophe_linkage_score: row.catastrophe_linkage_score,
                        contactability_score: row.contactability_score,
                        explainability: row.explainability_json
                    },
                    created_at: row.created_at
                }))
            });
        }
    }
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const category = (req.nextUrl.searchParams.get("category") || "").trim().toLowerCase();
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
    const limit = Math.max(1, Math.min(250, Number.isFinite(limitRaw) ? limitRaw : 50));
    let query = supabase
        .from("opportunities")
        .select("id,category,title,description,location_text,city,state,zip,territory,lat,lon,intent_score,confidence,urgency_score,tags,suggested_action,recommended_action,status,raw,created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(limit);
    if (category && category !== "all")
        query = query.eq("category", category);
    const { data, error } = await query;
    if (error)
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    return server_1.NextResponse.json({ opportunities: data || [] });
}
