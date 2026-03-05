import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import {
  type CampaignMode,
  runScanner,
  opportunityToLeadPayload
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
  const radius = Number.isFinite(body.radius) ? Number(body.radius) : 25;
  const triggers = Array.isArray(body.triggers) ? body.triggers.filter(Boolean).slice(0, 6) : [];

  if (!location || !service) {
    return NextResponse.json({ error: "location and service are required" }, { status: 400 });
  }

  const { data: settings } = await supabase
    .from("account_settings")
    .select("weather_lat,weather_lng")
    .eq("account_id", accountId)
    .maybeSingle();

  const lat = settings?.weather_lat != null ? Number(settings.weather_lat) : null;
  const lon = settings?.weather_lng != null ? Number(settings.weather_lng) : null;
  const fallbackCategory = String(service || "general").toLowerCase();
  const category =
    fallbackCategory.includes("restor") || fallbackCategory.includes("water") || fallbackCategory.includes("fire") || fallbackCategory.includes("mold")
      ? "restoration"
      : fallbackCategory.includes("plumb")
        ? "plumbing"
        : fallbackCategory.includes("demo") || fallbackCategory.includes("collapse")
          ? "demolition"
          : fallbackCategory.includes("asbestos")
            ? "asbestos"
            : "general";

  const scan = await runScanner({
    mode: "demo",
    location,
    categories: [category],
    limit: 16,
    lat,
    lon,
    radius,
    campaignMode: body.campaignMode,
    triggers
  });
  const risk = scan.weatherRisk;

  const campaignMode = CAMPAIGNS.includes(body.campaignMode || "Storm Response")
    ? (body.campaignMode as CampaignMode)
    : risk.highRisk
      ? "Storm Response"
      : "Roofing";

  const leads = scan.opportunities.map((op) => {
    const base = opportunityToLeadPayload(op);
    const urgency = String(base.requested_timeframe || "").toLowerCase().includes("asap")
      ? "high"
      : String(base.requested_timeframe || "").toLowerCase().includes("today")
        ? "medium"
        : "low";
    return {
      id: op.id,
      name: base.name,
      phone: base.phone,
      city: base.city,
      state: base.state,
      postal: base.postal_code,
      service_type: service,
      urgency,
      intentScore: op.intentScore,
      priorityLabel: op.priorityLabel,
      reason: op.reasonSummary,
      sourceMode: op.source === "google_places" ? "google_places" : "synthetic",
      signals: []
    };
  });

  return NextResponse.json({
    campaignMode,
    weatherRisk: risk,
    recommendedAction: risk.highRisk
      ? "High weather pressure detected. Prioritize storm response and fast outbound callbacks."
      : "Conditions are stable. Focus on scheduled maintenance and high-intent prospects.",
    leads,
    opportunities: scan.opportunities
  });
}
