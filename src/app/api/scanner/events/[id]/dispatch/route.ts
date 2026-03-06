import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { dispatchDemoScannerEvent } from "@/lib/demo/store";
import { generateSignals } from "@/lib/services/intent-engine";
import { isDemoMode } from "@/lib/services/review-mode";
import { getForecastByLatLng } from "@/lib/services/weather";

type CreateMode = "lead" | "job";

function normalizeMode(input: unknown): CreateMode | null {
  if (input == null) return null;
  return String(input).toLowerCase() === "job" ? "job" : "lead";
}

function statusFromMode(mode: CreateMode) {
  return mode === "job" ? "scheduled" : "new";
}

function stageFromStatus(status: string) {
  if (status === "scheduled") return "BOOKED";
  if (status === "contacted") return "CONTACTED";
  if (status === "won") return "COMPLETED";
  if (status === "lost") return "LOST";
  return "NEW";
}

function recommendedSchedule(intent: number, slaMinutes: number) {
  const d = new Date(Date.now() + Math.max(15, slaMinutes) * 60_000);
  if (intent >= 78) {
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
  }
  return d.toISOString();
}

function categoryService(category: string) {
  const c = String(category || "general").toLowerCase();
  if (c === "restoration") return "Restoration";
  if (c === "plumbing") return "Plumbing";
  if (c === "demolition") return "Demolition";
  if (c === "asbestos") return "Asbestos";
  return "General";
}

function randomPhone(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = 2000000 + (Math.abs(h >>> 0) % 7999999);
  return `+1631${String(n).padStart(7, "0")}`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isDemoMode()) {
    const body = (await req.json().catch(() => ({}))) as {
      createMode?: CreateMode;
    };
    const result = dispatchDemoScannerEvent(id, normalizeMode(body.createMode) || undefined);
    if (!result) {
      return NextResponse.json({ error: "Scanner event not found" }, { status: 404 });
    }

    return NextResponse.json({
      dispatched: true,
      mode: result.mode,
      leadId: result.leadId,
      jobId: result.jobId,
      message: result.message,
      redirectPath: "/dashboard/scanner?demoAction=1"
    });
  }

  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const body = (await req.json().catch(() => ({}))) as {
    createMode?: CreateMode;
    assignee?: string;
    scheduleIso?: string;
  };

  const { data: event, error: eventError } = await supabase
    .from("scanner_events")
    .select("id,category,title,description,location_text,intent_score,confidence,tags,raw,lat,lon")
    .eq("account_id", accountId)
    .eq("id", id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Scanner event not found" }, { status: 404 });
  }

  const { data: rule } = await supabase
    .from("routing_rules")
    .select("id,default_assignee,default_create_mode,default_job_value_cents,default_sla_minutes,enabled")
    .eq("account_id", accountId)
    .eq("category", String(event.category || "general").toLowerCase())
    .eq("enabled", true)
    .maybeSingle();

  const mode = normalizeMode(body.createMode) || (rule?.default_create_mode as CreateMode | null) || (Number(event.intent_score) >= 75 ? "job" : "lead");
  const assignee = (body.assignee || rule?.default_assignee || "Dispatch Queue").trim();
  const { data: contractor } = await supabase
    .from("contractors")
    .select("id")
    .eq("account_id", accountId)
    .eq("name", assignee)
    .maybeSingle();

  const location = String(event.location_text || "");
  const city = location.split(",")[0]?.trim() || "Service Area";
  const state = location.split(",")[1]?.trim() || "NY";

  const leadPayload = {
    account_id: accountId,
    source: "import",
    stage: stageFromStatus(statusFromMode(mode)),
    status: statusFromMode(mode),
    name: event.title,
    phone: randomPhone(`${event.id}:${event.title}`),
    service_type: categoryService(event.category),
    city,
    state,
    requested_timeframe: Number(event.intent_score) >= 78 ? "ASAP" : "Today",
    notes: `Scanner dispatch: ${event.description || "opportunity"}`
  };

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert(leadPayload)
    .select("id,service_type,requested_timeframe,city,state")
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: leadError?.message || "Failed to create lead" }, { status: 400 });
  }

  let forecast = null;
  if (event.lat != null && event.lon != null) {
    forecast = await getForecastByLatLng(Number(event.lat), Number(event.lon)).catch(() => null);
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

  if (mode === "lead") {
    await supabase
      .from("opportunities")
      .update({ status: "claimed", claimed_by_contractor_id: contractor?.id || null })
      .eq("account_id", accountId)
      .contains("raw", { scanner_opportunity_id: id });

    return NextResponse.json({
      dispatched: true,
      mode,
      leadId: lead.id,
      jobId: null
    });
  }

  const scheduleIso = body.scheduleIso || recommendedSchedule(Number(event.intent_score) || 60, Number(rule?.default_sla_minutes) || 60);
  const estimatedValue = Math.max(0, Math.round((Number(rule?.default_job_value_cents) || 60000) / 100));

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      account_id: accountId,
      lead_id: lead.id,
      status: "SCHEDULED",
      pipeline_status: "SCHEDULED",
      scheduled_for: scheduleIso,
      service_type: leadPayload.service_type,
      assigned_tech_name: assignee,
      estimated_value: estimatedValue,
      notes: `Auto-created from scanner event ${event.id}`,
      intent_score: Number(event.intent_score) || 0,
      customer_name: leadPayload.name,
      customer_phone: leadPayload.phone,
      city: leadPayload.city,
      state: leadPayload.state
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message || "Failed to create job" }, { status: 400 });
  }

  await supabase.from("lead_jobs").upsert(
    {
      account_id: accountId,
      lead_id: lead.id,
      job_id: job.id
    },
    { onConflict: "account_id,lead_id" }
  );

  await supabase
    .from("leads")
    .update({ converted_job_id: job.id, stage: "BOOKED", status: "scheduled", scheduled_for: scheduleIso })
    .eq("account_id", accountId)
    .eq("id", lead.id);

  await supabase
    .from("opportunities")
    .update({ status: "claimed", claimed_by_contractor_id: contractor?.id || null })
    .eq("account_id", accountId)
    .contains("raw", { scanner_opportunity_id: id });

  return NextResponse.json({
    dispatched: true,
    mode,
    leadId: lead.id,
    jobId: job.id,
    scheduleIso
  });
}
