"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const outbound_1 = require("@/lib/services/outbound");
const review_mode_1 = require("@/lib/services/review-mode");
function mapProspectRow(row, territoryFallback) {
    const city = (0, outbound_1.cleanText)(row.city);
    const state = (0, outbound_1.cleanText)(row.state);
    return {
        company_name: (0, outbound_1.cleanText)(row.company_name) || (0, outbound_1.cleanText)(row.name) || "New Prospect",
        contact_name: (0, outbound_1.cleanText)(row.contact_name),
        title: (0, outbound_1.cleanText)(row.title),
        email: (0, outbound_1.cleanText)(row.email),
        phone: (0, outbound_1.cleanText)(row.phone),
        website: (0, outbound_1.cleanText)(row.website),
        city,
        state,
        zip: (0, outbound_1.cleanText)(row.zip) || (0, outbound_1.cleanText)(row.postal_code),
        territory: (0, outbound_1.cleanText)(row.territory) || territoryFallback || (0, outbound_1.buildTerritory)([city, state]),
        prospect_type: (0, outbound_1.cleanText)(row.prospect_type) || (0, outbound_1.cleanText)(row.segment) || "property_manager",
        property_type: (0, outbound_1.cleanText)(row.property_type),
        building_count: (0, outbound_1.cleanNumber)(row.building_count),
        priority_tier: (0, outbound_1.cleanText)(row.priority_tier) || "standard",
        strategic_value: (0, outbound_1.cleanNumber)(row.strategic_value) || 50,
        near_active_incident: (0, outbound_1.parseBooleanFlag)(row.near_active_incident) || false,
        notes: (0, outbound_1.cleanText)(row.notes),
        tags: (0, outbound_1.normalizeTagList)(row.tags),
        source: (0, outbound_1.cleanText)(row.source) || "manual"
    };
}
async function GET(req) {
    const territory = (0, outbound_1.cleanText)(req.nextUrl.searchParams.get("territory"));
    const segment = (0, outbound_1.cleanText)(req.nextUrl.searchParams.get("segment"));
    const search = (0, outbound_1.cleanText)(req.nextUrl.searchParams.get("search"));
    const nearIncident = (0, outbound_1.parseBooleanFlag)(req.nextUrl.searchParams.get("nearIncident"));
    if ((0, review_mode_1.isDemoMode)()) {
        const prospects = (0, store_1.listDemoProspects)({ territory, segment, search, nearIncident });
        return server_1.NextResponse.json({ prospects });
    }
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    let query = supabase.from("prospects").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).limit(250);
    if (territory && territory !== "all")
        query = query.eq("territory", territory);
    if (segment && segment !== "all")
        query = query.eq("prospect_type", segment);
    if (nearIncident != null)
        query = query.eq("near_active_incident", nearIncident);
    if (search)
        query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,city.ilike.%${search}%`);
    const { data, error } = await query;
    if (error)
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    return server_1.NextResponse.json({ prospects: data || [] });
}
async function POST(req) {
    const body = (await req.json().catch(() => ({})));
    const rows = Array.isArray(body.rows) ? body.rows : [body];
    if ((0, review_mode_1.isDemoMode)()) {
        const created = rows.map((row) => (0, store_1.createDemoProspect)(mapProspectRow(row))).filter(Boolean);
        return server_1.NextResponse.json({ prospects: created });
    }
    const { accountId, role, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    const cleaned = rows.map((row) => ({ account_id: accountId, ...mapProspectRow(row) })).filter((row) => row.company_name);
    if (cleaned.length === 0)
        return server_1.NextResponse.json({ error: "No valid prospects supplied" }, { status: 400 });
    const { data, error } = await supabase.from("prospects").insert(cleaned).select("*");
    if (error)
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    return server_1.NextResponse.json({ prospects: data || [] });
}
