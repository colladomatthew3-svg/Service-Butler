import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { getForecastByLatLng } from "@/lib/services/weather";
import {
  fetchGooglePlacesLeads,
  generateSyntheticScannerLeads,
  weatherRisk,
  type CampaignMode
} from "@/lib/services/scanner";

const CAMPAIGNS: CampaignMode[] = ["Storm Response", "Roofing", "Water Damage", "HVAC Emergency"];

export async function POST(req: NextRequest) {
  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const body = (await req.json()) as {
    location?: string;
    service?: string;
    radius?: number;
    triggers?: string[];
    campaignMode?: CampaignMode;
  };

  const location = body.location?.trim();
  const service = body.service?.trim();
  const radius = Number.isFinite(body.radius) ? Number(body.radius) : 10;
  const triggers = Array.isArray(body.triggers) ? body.triggers.filter(Boolean).slice(0, 6) : [];

  if (!location || !service) {
    return NextResponse.json({ error: "location and service are required" }, { status: 400 });
  }

  const { data: settings } = await supabase
    .from("account_settings")
    .select("weather_lat,weather_lng")
    .eq("account_id", accountId)
    .maybeSingle();

  let forecast = null;
  if (settings?.weather_lat != null && settings?.weather_lng != null) {
    try {
      forecast = await getForecastByLatLng(Number(settings.weather_lat), Number(settings.weather_lng));
    } catch {
      forecast = null;
    }
  }

  const risk = weatherRisk(forecast);
  const campaignMode = CAMPAIGNS.includes(body.campaignMode || "Storm Response")
    ? (body.campaignMode as CampaignMode)
    : risk.highRisk
      ? "Storm Response"
      : "Roofing";

  let leads = await fetchGooglePlacesLeads({
    location,
    service,
    radius,
    triggers,
    forecast,
    campaignMode
  });

  if (leads.length === 0) {
    leads = generateSyntheticScannerLeads({
      location,
      service,
      radius,
      triggers,
      forecast,
      campaignMode
    });
  }

  return NextResponse.json({
    campaignMode,
    weatherRisk: risk,
    recommendedAction: risk.highRisk
      ? "High weather pressure detected. Prioritize storm response and fast outbound callbacks."
      : "Conditions are stable. Focus on scheduled maintenance and high-intent prospects.",
    leads
  });
}
