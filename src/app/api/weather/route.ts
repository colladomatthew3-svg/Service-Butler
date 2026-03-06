import { NextRequest, NextResponse } from "next/server";
import { getForecastByLatLng } from "@/lib/services/weather";
import { isDemoMode } from "@/lib/services/review-mode";
import { getDemoWeatherSettings } from "@/lib/demo/store";

export async function GET(req: NextRequest) {
  let lat = Number(req.nextUrl.searchParams.get("lat"));
  let lng = Number(req.nextUrl.searchParams.get("lng"));

  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && isDemoMode()) {
    const settings = await getDemoWeatherSettings();
    lat = settings.weather_lat;
    lng = settings.weather_lng;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required numbers" }, { status: 400 });
  }

  try {
    const forecast = await getForecastByLatLng(lat, lng);
    return NextResponse.json(forecast);
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to fetch weather", detail: error instanceof Error ? error.message : "unknown error" },
      { status: 502 }
    );
  }
}
