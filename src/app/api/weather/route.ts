import { NextRequest, NextResponse } from "next/server";
import { getForecastByLatLng } from "@/lib/services/weather";
import { isDemoMode } from "@/lib/services/review-mode";
import { getDemoWeatherSettings } from "@/lib/demo/store";
import { getCurrentUserContext } from "@/lib/auth/rbac";

function isValidLatLng(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export async function GET(req: NextRequest) {
  const forceLive = String(req.nextUrl.searchParams.get("live") || "").trim() === "1";
  let lat = Number(req.nextUrl.searchParams.get("lat"));
  let lng = Number(req.nextUrl.searchParams.get("lng"));

  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && isDemoMode()) {
    const settings = await getDemoWeatherSettings();
    lat = settings.weather_lat;
    lng = settings.weather_lng;
  }

  if ((!isValidLatLng(lat, lng)) && !isDemoMode()) {
    try {
      const { accountId, supabase } = await getCurrentUserContext();
      const { data } = await supabase
        .from("account_settings")
        .select("weather_lat,weather_lng")
        .eq("account_id", accountId)
        .maybeSingle();

      if (data?.weather_lat != null && data?.weather_lng != null) {
        lat = Number(data.weather_lat);
        lng = Number(data.weather_lng);
      }
    } catch {
      // Keep graceful fallback response below.
    }
  }

  if (!isValidLatLng(lat, lng)) {
    return NextResponse.json({ error: "lat and lng are required numbers" }, { status: 400 });
  }

  try {
    const forecast = await getForecastByLatLng(lat, lng, { forceLive });
    return NextResponse.json(forecast, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to fetch weather", detail: error instanceof Error ? error.message : "unknown error" },
      { status: 502 }
    );
  }
}
