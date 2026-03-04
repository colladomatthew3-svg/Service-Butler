import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { generateSignals } from "@/lib/services/intent-engine";
import { getForecastByLatLng } from "@/lib/services/weather";

function statusToStage(status: string) {
  switch (status) {
    case "new":
      return "NEW";
    case "contacted":
      return "CONTACTED";
    case "scheduled":
      return "BOOKED";
    case "won":
      return "COMPLETED";
    case "lost":
      return "LOST";
    default:
      return "NEW";
  }
}

export async function GET(req: NextRequest) {
  const { accountId, supabase } = await getCurrentUserContext();
  const status = req.nextUrl.searchParams.get("status");
  const service = req.nextUrl.searchParams.get("service");
  const search = req.nextUrl.searchParams.get("search");

  let query = supabase
    .from("leads")
    .select(
      "id,created_at,status,name,phone,service_type,address,city,state,postal_code,requested_timeframe,source,notes,scheduled_for,converted_job_id"
    )
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);
  if (service && service !== "all") query = query.eq("service_type", service);
  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,address.ilike.%${search}%,city.ilike.%${search}%`);

  const { data: leads, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const leadIds = (leads || []).map((l) => l.id as string);
  let signalScoresByLead: Record<string, number[]> = {};

  if (leadIds.length > 0) {
    const { data: signals } = await supabase
      .from("lead_intent_signals")
      .select("lead_id,score")
      .in("lead_id", leadIds);
    signalScoresByLead = (signals || []).reduce<Record<string, number[]>>((acc, row) => {
      const key = row.lead_id as string;
      if (!acc[key]) acc[key] = [];
      acc[key].push(Number(row.score) || 0);
      return acc;
    }, {});
  }

  const enriched = (leads || []).map((lead) => {
    const scores = signalScoresByLead[lead.id as string] || [];
    const intentScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return { ...lead, intentScore, signalCount: scores.length };
  });

  const counts = enriched.reduce<Record<string, number>>((acc, lead) => {
    const key = String(lead.status || "new");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ leads: enriched, counts });
}

export async function POST(req: NextRequest) {
  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const body = (await req.json()) as {
    name: string;
    phone: string;
    service_type: string;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    requested_timeframe?: string;
    source?: string;
    notes?: string;
  };

  const status = "new";
  const insertPayload = {
    account_id: accountId,
    status,
    stage: statusToStage(status),
    name: body.name?.trim(),
    phone: body.phone?.trim(),
    service_type: body.service_type?.trim(),
    address: body.address?.trim() || null,
    city: body.city?.trim() || null,
    state: body.state?.trim() || null,
    postal_code: body.postal_code?.trim() || null,
    requested_timeframe: body.requested_timeframe?.trim() || null,
    source: body.source?.trim() || "manual",
    notes: body.notes?.trim() || null
  };

  const { data: lead, error } = await supabase
    .from("leads")
    .insert(insertPayload)
    .select("id,service_type,requested_timeframe,city,state")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

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
  if (signals.length > 0) {
    await supabase.from("lead_intent_signals").insert(
      signals.map((signal) => ({
        lead_id: lead.id,
        ...signal
      }))
    );
  }

  return NextResponse.json({ leadId: lead.id }, { status: 201 });
}
