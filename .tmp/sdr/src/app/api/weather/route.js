"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const weather_1 = require("@/lib/services/weather");
const review_mode_1 = require("@/lib/services/review-mode");
const store_1 = require("@/lib/demo/store");
const rbac_1 = require("@/lib/auth/rbac");
function isValidLatLng(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
async function GET(req) {
    const forceLive = String(req.nextUrl.searchParams.get("live") || "").trim() === "1";
    let lat = Number(req.nextUrl.searchParams.get("lat"));
    let lng = Number(req.nextUrl.searchParams.get("lng"));
    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && (0, review_mode_1.isDemoMode)()) {
        const settings = await (0, store_1.getDemoWeatherSettings)();
        lat = settings.weather_lat;
        lng = settings.weather_lng;
    }
    if ((!isValidLatLng(lat, lng)) && !(0, review_mode_1.isDemoMode)()) {
        try {
            const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
            const { data } = await supabase
                .from("account_settings")
                .select("weather_lat,weather_lng")
                .eq("account_id", accountId)
                .maybeSingle();
            if (data?.weather_lat != null && data?.weather_lng != null) {
                lat = Number(data.weather_lat);
                lng = Number(data.weather_lng);
            }
        }
        catch {
            // Keep graceful fallback response below.
        }
    }
    if (!isValidLatLng(lat, lng)) {
        return server_1.NextResponse.json({ error: "lat and lng are required numbers" }, { status: 400 });
    }
    try {
        const forecast = await (0, weather_1.getForecastByLatLng)(lat, lng, { forceLive });
        return server_1.NextResponse.json(forecast, {
            headers: {
                "Cache-Control": "private, max-age=60, stale-while-revalidate=120"
            }
        });
    }
    catch (error) {
        return server_1.NextResponse.json({ error: "Unable to fetch weather", detail: error instanceof Error ? error.message : "unknown error" }, { status: 502 });
    }
}
