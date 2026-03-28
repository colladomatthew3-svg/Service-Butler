"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const scanner_1 = require("@/lib/services/scanner");
const review_mode_1 = require("@/lib/services/review-mode");
const CAMPAIGNS = ["Storm Response", "Roofing", "Water Damage", "HVAC Emergency"];
async function POST(req) {
    const { accountId, role, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    const body = (await req.json());
    const location = body.location?.trim();
    const service = body.service?.trim();
    const radius = Number.isFinite(body.radius) ? Number(body.radius) : 25;
    const triggers = Array.isArray(body.triggers) ? body.triggers.filter(Boolean).slice(0, 6) : [];
    if (!location || !service) {
        return server_1.NextResponse.json({ error: "location and service are required" }, { status: 400 });
    }
    const { data: settings } = await supabase
        .from("account_settings")
        .select("weather_lat,weather_lng")
        .eq("account_id", accountId)
        .maybeSingle();
    const lat = settings?.weather_lat != null ? Number(settings.weather_lat) : null;
    const lon = settings?.weather_lng != null ? Number(settings.weather_lng) : null;
    const fallbackCategory = String(service || "general").toLowerCase();
    const category = fallbackCategory.includes("restor") || fallbackCategory.includes("water") || fallbackCategory.includes("fire") || fallbackCategory.includes("mold")
        ? "restoration"
        : fallbackCategory.includes("plumb")
            ? "plumbing"
            : fallbackCategory.includes("demo") || fallbackCategory.includes("collapse")
                ? "demolition"
                : fallbackCategory.includes("asbestos")
                    ? "asbestos"
                    : "general";
    const scan = await (0, scanner_1.runScanner)({
        mode: (0, review_mode_1.isDemoMode)() ? "demo" : "live",
        location,
        categories: [category],
        limit: 16,
        lat,
        lon,
        radius,
        campaignMode: body.campaignMode,
        triggers
    });
    const risk = scan.weatherRisk;
    const campaignMode = CAMPAIGNS.includes(body.campaignMode || "Storm Response")
        ? body.campaignMode
        : risk.highRisk
            ? "Storm Response"
            : "Roofing";
    const leads = scan.opportunities.map((op) => {
        const base = (0, scanner_1.opportunityToLeadPayload)(op);
        const urgency = String(base.requested_timeframe || "").toLowerCase().includes("asap")
            ? "high"
            : String(base.requested_timeframe || "").toLowerCase().includes("today")
                ? "medium"
                : "low";
        return {
            id: op.id,
            name: base.name,
            phone: base.phone,
            city: base.city,
            state: base.state,
            postal: base.postal_code,
            service_type: service,
            urgency,
            intentScore: op.intentScore,
            priorityLabel: op.priorityLabel,
            reason: op.reasonSummary,
            sourceMode: op.source,
            signals: []
        };
    });
    return server_1.NextResponse.json({
        campaignMode,
        weatherRisk: risk,
        recommendedAction: risk.highRisk
            ? "High weather pressure detected. Prioritize storm response and fast outbound callbacks."
            : "Conditions are stable. Focus on scheduled maintenance and high-intent prospects.",
        leads,
        opportunities: scan.opportunities
    });
}
