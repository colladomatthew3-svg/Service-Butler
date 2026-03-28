"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const weather_1 = require("@/lib/services/weather");
const review_mode_1 = require("@/lib/services/review-mode");
async function GET() {
    if ((0, review_mode_1.isDemoMode)()) {
        const data = await (0, store_1.getDemoWeatherSettings)();
        return server_1.NextResponse.json(data);
    }
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const { data } = await supabase
        .from("account_settings")
        .select("weather_location_label,weather_lat,weather_lng,home_base_city,home_base_state,home_base_postal_code")
        .eq("account_id", accountId)
        .maybeSingle();
    return server_1.NextResponse.json(data || {});
}
async function POST(req) {
    if ((0, review_mode_1.isDemoMode)()) {
        const body = (await req.json());
        let label = body.label?.trim();
        let lat = Number(body.lat);
        let lng = Number(body.lng);
        if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && (body.city || body.state || body.postalCode)) {
            const query = [body.city, body.state, body.postalCode].filter(Boolean).join(", ");
            const geo = await (0, weather_1.geocodeLocation)(query);
            if (geo) {
                label = label || geo.label;
                lat = geo.lat;
                lng = geo.lng;
            }
        }
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return server_1.NextResponse.json({ error: "Provide lat/lng or a resolvable location" }, { status: 400 });
        }
        const payload = {
            weather_location_label: label || `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
            weather_lat: lat,
            weather_lng: lng,
            home_base_city: body.city || null,
            home_base_state: body.state || null,
            home_base_postal_code: body.postalCode || null
        };
        const response = server_1.NextResponse.json(payload);
        response.cookies.set("sb_demo_weather", (0, store_1.createDemoWeatherCookieValue)(payload), {
            httpOnly: false,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 30
        });
        return response;
    }
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const body = (await req.json());
    let label = body.label?.trim();
    let lat = Number(body.lat);
    let lng = Number(body.lng);
    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && (body.city || body.state || body.postalCode)) {
        const query = [body.city, body.state, body.postalCode].filter(Boolean).join(", ");
        const geo = await (0, weather_1.geocodeLocation)(query);
        if (geo) {
            label = label || geo.label;
            lat = geo.lat;
            lng = geo.lng;
        }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return server_1.NextResponse.json({ error: "Provide lat/lng or a resolvable location" }, { status: 400 });
    }
    const payload = {
        account_id: accountId,
        weather_location_label: label || `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
        weather_lat: lat,
        weather_lng: lng,
        home_base_city: body.city || null,
        home_base_state: body.state || null,
        home_base_postal_code: body.postalCode || null
    };
    const { data, error } = await supabase
        .from("account_settings")
        .upsert(payload, { onConflict: "account_id" })
        .select("weather_location_label,weather_lat,weather_lng,home_base_city,home_base_state,home_base_postal_code")
        .single();
    if (error)
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    return server_1.NextResponse.json(data);
}
