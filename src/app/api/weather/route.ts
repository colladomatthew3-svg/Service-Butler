import { NextRequest, NextResponse } from "next/server";
import { getForecastByLatLng } from "@/lib/services/weather";

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));

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
