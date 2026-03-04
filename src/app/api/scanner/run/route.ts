import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { runScanner } from "@/lib/services/scanner";

export async function POST(req: NextRequest) {
  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const body = (await req.json()) as {
    mode?: "demo" | "live";
    location?: string;
    categories?: string[];
    limit?: number;
    lat?: number;
    lon?: number;
    radius?: number;
    campaignMode?: "Storm Response" | "Roofing" | "Water Damage" | "HVAC Emergency";
    triggers?: string[];
  };

  const mode = body.mode === "live" ? "live" : "demo";
  const location = String(body.location || "").trim();

  let lat = Number(body.lat);
  let lon = Number(body.lon);
  if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && !location) {
    const { data: settings } = await supabase
      .from("account_settings")
      .select("weather_lat,weather_lng,weather_location_label,home_base_city,home_base_state")
      .eq("account_id", accountId)
      .maybeSingle();

    if (settings?.weather_lat != null && settings?.weather_lng != null) {
      lat = Number(settings.weather_lat);
      lon = Number(settings.weather_lng);
    }

    if (!location) {
      const fallbackLabel = settings?.weather_location_label || [settings?.home_base_city, settings?.home_base_state].filter(Boolean).join(", ");
      if (fallbackLabel) {
        body.location = fallbackLabel;
      }
    }
  }

  const result = await runScanner({
    mode,
    location: String(body.location || location || "Service Area"),
    categories: Array.isArray(body.categories) ? body.categories : undefined,
    limit: Number.isFinite(body.limit) ? Number(body.limit) : 20,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    radius: Number.isFinite(body.radius) ? Number(body.radius) : 25,
    campaignMode: body.campaignMode,
    triggers: Array.isArray(body.triggers) ? body.triggers : undefined
  });

  if (result.opportunities.length > 0) {
    await supabase.from("scanner_events").insert(
      result.opportunities.map((op) => ({
        account_id: accountId,
        source: op.source,
        category: op.category,
        title: op.title,
        description: op.description,
        location_text: op.locationText,
        lat: op.lat,
        lon: op.lon,
        intent_score: op.intentScore,
        confidence: op.confidence,
        tags: op.tags,
        raw: {
          ...op.raw,
          next_action: op.nextAction,
          reason_summary: op.reasonSummary,
          recommended_create_mode: op.recommendedCreateMode,
          recommended_schedule_iso: op.recommendedScheduleIso
        }
      }))
    );
  }

  return NextResponse.json({
    mode: result.mode,
    weatherRisk: result.weatherRisk,
    locationResolved: result.locationResolved,
    opportunities: result.opportunities
  });
}
