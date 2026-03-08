import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { addDemoScannerEvents, getDemoWeatherSettings } from "@/lib/demo/store";
import { runScanner } from "@/lib/services/scanner";
import { isDemoMode } from "@/lib/services/review-mode";

type ScannerRunRequestBody = {
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

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    const body = await readScannerRunBody(req);

    const settings = await getDemoWeatherSettings();
    const location = String(body.location || "").trim() || settings.weather_location_label;
    const lat = Number.isFinite(body.lat) ? Number(body.lat) : settings.weather_lat;
    const lon = Number.isFinite(body.lon) ? Number(body.lon) : settings.weather_lng;

    const result = await runScanner({
      mode: "demo",
      location,
      categories: Array.isArray(body.categories) ? body.categories : undefined,
      limit: Number.isFinite(body.limit) ? Number(body.limit) : 20,
      lat,
      lon,
      radius: Number.isFinite(body.radius) ? Number(body.radius) : 25,
      campaignMode: body.campaignMode,
      triggers: Array.isArray(body.triggers) ? body.triggers : undefined
    });

    addDemoScannerEvents(result.opportunities);

    return NextResponse.json({
      mode: result.mode,
      weatherRisk: result.weatherRisk,
      locationResolved: result.locationResolved,
      opportunities: result.opportunities
    });
  }

  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const body = await readScannerRunBody(req);

  const mode = body.mode ? (body.mode === "live" ? "live" : "demo") : "live";
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
    const sourceRows = result.opportunities.map((op) => ({
      account_id: accountId,
      source_type: "scanner_signal",
      platform: op.source,
      source_url: typeof op.raw?.source_url === "string" ? op.raw.source_url : null,
      headline: op.title,
      body_text: op.description,
      published_at: op.createdAtIso || new Date().toISOString(),
      raw_location_text: op.locationText,
      signal_category: op.category,
      service_category_candidate: String(op.raw?.service_type || op.category || "general"),
      damage_keywords: op.tags,
      urgency_keywords: [String(op.raw?.urgency_window || op.priorityLabel || "monitor")],
      media_count: Array.isArray(op.raw?.media_urls) ? op.raw.media_urls.length : 0,
      raw_payload_json: {
        ...op.raw,
        scanner_opportunity_id: op.id
      }
    }));

    const { data: sourceEvents } = await supabase.from("source_events").insert(sourceRows).select("id");
    const sourceEventIds = (sourceEvents || []).map((item) => String(item.id));

    const rows = result.opportunities.map((op) => ({
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
        scanner_opportunity_id: op.id,
        next_action: op.nextAction,
        reason_summary: op.reasonSummary,
        recommended_create_mode: op.recommendedCreateMode,
        recommended_schedule_iso: op.recommendedScheduleIso
      }
    }));

    await supabase.from("scanner_events").insert(rows);

    await supabase.from("opportunities").insert(
      result.opportunities.map((op, index) => ({
        account_id: accountId,
        source_id: null,
        category: op.category,
        lead_type: String(op.raw?.lead_type || "direct"),
        title: op.title,
        description: op.description,
        service_category: String(op.raw?.service_type || op.category || "general"),
        location_text: op.locationText,
        city: typeof op.raw?.property_city === "string" ? op.raw.property_city : null,
        state: typeof op.raw?.property_state === "string" ? op.raw.property_state : null,
        zip: typeof op.raw?.property_postal_code === "string" ? op.raw.property_postal_code : null,
        territory: typeof op.raw?.territory === "string" ? op.raw.territory : typeof op.raw?.service_area_label === "string" ? op.raw.service_area_label : null,
        lat: op.lat,
        lon: op.lon,
        intent_score: op.intentScore,
        confidence: op.confidence,
        urgency_score: Number(op.raw?.urgency_score || 0),
        tags: op.tags,
        suggested_action: op.nextAction,
        recommended_action: op.nextAction,
        source_event_ids: sourceEventIds[index] ? [sourceEventIds[index]] : [],
        status: "new",
        raw: {
          ...op.raw,
          source: op.source,
          scanner_opportunity_id: op.id,
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

async function readScannerRunBody(req: NextRequest): Promise<ScannerRunRequestBody> {
  try {
    return (await req.json()) as ScannerRunRequestBody;
  } catch {
    return {};
  }
}
