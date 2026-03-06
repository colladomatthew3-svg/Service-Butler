import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { getDemoLead, getDemoLeadSignals } from "@/lib/demo/store";
import { generateSignals } from "@/lib/services/intent-engine";
import { isDemoMode } from "@/lib/services/review-mode";
import { getForecastByLatLng } from "@/lib/services/weather";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isDemoMode()) {
    const lead = getDemoLead(id);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    const signals = getDemoLeadSignals(id);
    return NextResponse.json({ regenerated: true, count: signals.length });
  }

  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const { data: lead, error } = await supabase
    .from("leads")
    .select("id,service_type,requested_timeframe,city,state")
    .eq("account_id", accountId)
    .eq("id", id)
    .single();

  if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  let forecast = null;
  const { data: settings } = await supabase
    .from("account_settings")
    .select("weather_lat,weather_lng")
    .eq("account_id", accountId)
    .maybeSingle();

  if (settings?.weather_lat != null && settings?.weather_lng != null) {
    try {
      forecast = await getForecastByLatLng(Number(settings.weather_lat), Number(settings.weather_lng));
    } catch {
      forecast = null;
    }
  }

  const signals = generateSignals({ lead, forecast });

  await supabase.from("lead_intent_signals").delete().eq("lead_id", id);
  if (signals.length > 0) {
    const { error: insertError } = await supabase.from("lead_intent_signals").insert(
      signals.map((signal) => ({
        lead_id: id,
        ...signal
      }))
    );
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ regenerated: true, count: signals.length });
}
