"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const outbound_1 = require("@/lib/services/outbound");
const review_mode_1 = require("@/lib/services/review-mode");
async function POST(req) {
    const body = (await req.json());
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length === 0)
        return server_1.NextResponse.json({ error: "No rows supplied" }, { status: 400 });
    const cleaned = rows
        .map((row) => ({
        name: String(row.name || "").trim(),
        phone: row.phone ? String(row.phone).trim() : null,
        email: row.email ? String(row.email).trim() : null,
        service_type: row.service_type ? String(row.service_type).trim() : null,
        city: row.city ? String(row.city).trim() : null,
        state: row.state ? String(row.state).trim() : null,
        postal_code: row.postal_code ? String(row.postal_code).trim() : null,
        tags: Array.isArray(row.tags) ? row.tags.slice(0, 12).map((tag) => String(tag).trim()).filter(Boolean) : [],
        source: "csv"
    }))
        .filter((row) => row.name.length > 0);
    if (cleaned.length === 0)
        return server_1.NextResponse.json({ error: "All rows were empty" }, { status: 400 });
    if ((0, review_mode_1.isDemoMode)()) {
        for (const row of cleaned) {
            (0, store_1.createDemoProspect)({
                company_name: row.name,
                contact_name: row.name,
                email: row.email,
                phone: row.phone,
                city: row.city,
                state: row.state,
                zip: row.postal_code,
                territory: (0, outbound_1.buildTerritory)([row.city, row.state]),
                prospect_type: row.service_type || "property_manager",
                tags: row.tags,
                source: row.source
            });
        }
        return server_1.NextResponse.json({ inserted: cleaned.length });
    }
    const { accountId, role, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    const scoped = cleaned.map((row) => ({ ...row, account_id: accountId }));
    const [{ error }, { error: prospectError }] = await Promise.all([
        supabase.from("outbound_contacts").insert(scoped),
        supabase.from("prospects").insert(scoped.map((row) => ({
            account_id: accountId,
            company_name: row.name,
            contact_name: row.name,
            email: row.email,
            phone: row.phone,
            city: row.city,
            state: row.state,
            zip: row.postal_code,
            territory: (0, outbound_1.buildTerritory)([row.city, row.state]),
            prospect_type: row.service_type || "property_manager",
            tags: row.tags,
            source: row.source
        })))
    ]);
    if (error || prospectError)
        return server_1.NextResponse.json({ error: error?.message || prospectError?.message }, { status: 400 });
    return server_1.NextResponse.json({ inserted: scoped.length });
}
