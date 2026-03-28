"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const intent_engine_1 = require("@/lib/services/intent-engine");
const review_mode_1 = require("@/lib/services/review-mode");
const weather_1 = require("@/lib/services/weather");
async function POST(_, { params }) {
    const { id } = await params;
    if ((0, review_mode_1.isDemoMode)()) {
        const lead = (0, store_1.getDemoLead)(id);
        if (!lead)
            return server_1.NextResponse.json({ error: "Lead not found" }, { status: 404 });
        const signals = (0, store_1.getDemoLeadSignals)(id);
        return server_1.NextResponse.json({ regenerated: true, count: signals.length });
    }
    const { accountId, role, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    const { data: lead, error } = await supabase
        .from("leads")
        .select("id,service_type,requested_timeframe,city,state")
        .eq("account_id", accountId)
        .eq("id", id)
        .single();
    if (error || !lead)
        return server_1.NextResponse.json({ error: "Lead not found" }, { status: 404 });
    let forecast = null;
    const { data: settings } = await supabase
        .from("account_settings")
        .select("weather_lat,weather_lng")
        .eq("account_id", accountId)
        .maybeSingle();
    if (settings?.weather_lat != null && settings?.weather_lng != null) {
        try {
            forecast = await (0, weather_1.getForecastByLatLng)(Number(settings.weather_lat), Number(settings.weather_lng));
        }
        catch {
            forecast = null;
        }
    }
    const signals = (0, intent_engine_1.generateSignals)({ lead, forecast });
    await supabase.from("lead_intent_signals").delete().eq("lead_id", id);
    if (signals.length > 0) {
        const { error: insertError } = await supabase.from("lead_intent_signals").insert(signals.map((signal) => ({
            lead_id: id,
            ...signal
        })));
        if (insertError)
            return server_1.NextResponse.json({ error: insertError.message }, { status: 400 });
    }
    return server_1.NextResponse.json({ regenerated: true, count: signals.length });
}
