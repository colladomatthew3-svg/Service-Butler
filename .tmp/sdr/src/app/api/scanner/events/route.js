"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const review_mode_1 = require("@/lib/services/review-mode");
async function GET(req) {
    if ((0, review_mode_1.isDemoMode)()) {
        const source = req.nextUrl.searchParams.get("source");
        const category = req.nextUrl.searchParams.get("category");
        const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
        const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
        const q = (req.nextUrl.searchParams.get("q") || "").trim();
        return server_1.NextResponse.json({
            events: (0, store_1.listDemoScannerEvents)({ source, category, limit, query: q })
        });
    }
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const source = req.nextUrl.searchParams.get("source");
    const category = req.nextUrl.searchParams.get("category");
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
    const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    let query = supabase
        .from("scanner_events")
        .select("id,source,category,title,description,location_text,lat,lon,intent_score,confidence,tags,raw,created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(limit);
    if (source && source !== "all")
        query = query.eq("source", source);
    if (category && category !== "all")
        query = query.eq("category", category);
    if (q) {
        query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,location_text.ilike.%${q}%`);
    }
    const { data, error } = await query;
    if (error) {
        const message = String(error.message || "");
        const missingScannerTable = message.includes("scanner_events") &&
            (message.includes("schema cache") || message.includes("does not exist") || message.includes("not found"));
        if (missingScannerTable) {
            return server_1.NextResponse.json({
                events: [],
                warning: "Scanner events table is unavailable locally. Run migrations to enable persisted feed."
            });
        }
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    }
    return server_1.NextResponse.json({ events: data || [] });
}
