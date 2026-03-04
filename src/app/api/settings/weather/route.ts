import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { geocodeLocation } from "@/lib/services/weather";

export async function GET() {
  const { accountId, supabase } = await getCurrentUserContext();
  const { data } = await supabase
    .from("account_settings")
    .select("weather_location_label,weather_lat,weather_lng,home_base_city,home_base_state,home_base_postal_code")
    .eq("account_id", accountId)
    .maybeSingle();

  return NextResponse.json(data || {});
}

export async function POST(req: NextRequest) {
  const { accountId, supabase } = await getCurrentUserContext();
  const body = (await req.json()) as {
    label?: string;
    lat?: number;
    lng?: number;
    city?: string;
    state?: string;
    postalCode?: string;
  };

  let label = body.label?.trim();
  let lat = Number(body.lat);
  let lng = Number(body.lng);

  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && (body.city || body.state || body.postalCode)) {
    const query = [body.city, body.state, body.postalCode].filter(Boolean).join(", ");
    const geo = await geocodeLocation(query);
    if (geo) {
      label = label || geo.label;
      lat = geo.lat;
      lng = geo.lng;
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Provide lat/lng or a resolvable location" }, { status: 400 });
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

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
