import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { getDemoDashboardSnapshot } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/services/review-mode";

type PipelineStatus = "NEW" | "CONTACTED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "WON" | "LOST";

const VALID_PIPELINE: PipelineStatus[] = ["NEW", "CONTACTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "WON", "LOST"];

function toJobStatus(pipeline: PipelineStatus): "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED" {
  if (pipeline === "IN_PROGRESS") return "IN_PROGRESS";
  if (pipeline === "COMPLETED" || pipeline === "WON") return "COMPLETED";
  if (pipeline === "LOST") return "CANCELED";
  return "SCHEDULED";
}

export async function GET(req: NextRequest) {
  if (isDemoMode()) {
    const pipeline = req.nextUrl.searchParams.get("pipeline");
    const snapshot = getDemoDashboardSnapshot();
    const jobs = (snapshot.jobs || []).filter((job) => {
      if (!pipeline) return true;
      return String(job.pipeline_status || "").toUpperCase() === String(pipeline).toUpperCase();
    });
    return NextResponse.json({ jobs });
  }

  const { accountId, supabase } = await getCurrentUserContext();
  const pipeline = req.nextUrl.searchParams.get("pipeline");

  let query = supabase
    .from("jobs")
    .select(
      "id,lead_id,pipeline_status,status,scheduled_for,service_type,assigned_user_id,assigned_tech_name,estimated_value,notes,intent_score,customer_name,customer_phone,address,city,state,postal_code,created_at"
    )
    .eq("account_id", accountId)
    .order("scheduled_for", { ascending: true, nullsFirst: false });

  if (pipeline && VALID_PIPELINE.includes(pipeline as PipelineStatus)) {
    query = query.eq("pipeline_status", pipeline);
  }

  const { data: jobs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ jobs: jobs || [] });
}

export async function POST(req: NextRequest) {
  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const body = (await req.json()) as {
    lead_id?: string;
    pipeline_status?: PipelineStatus;
    scheduled_for?: string | null;
    service_type?: string;
    assigned_user_id?: string | null;
    assigned_tech_name?: string | null;
    estimated_value?: number;
    notes?: string | null;
    intent_score?: number;
    customer_name?: string | null;
    customer_phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
  };

  if (!body.lead_id) {
    return NextResponse.json({ error: "lead_id is required" }, { status: 400 });
  }

  const pipeline = VALID_PIPELINE.includes((body.pipeline_status || "NEW") as PipelineStatus)
    ? (body.pipeline_status as PipelineStatus)
    : "NEW";

  const payload = {
    account_id: accountId,
    lead_id: body.lead_id,
    pipeline_status: pipeline,
    status: toJobStatus(pipeline),
    scheduled_for: body.scheduled_for ? new Date(body.scheduled_for).toISOString() : null,
    service_type: body.service_type?.trim() || null,
    assigned_user_id: body.assigned_user_id || null,
    assigned_tech_name: body.assigned_tech_name?.trim() || null,
    estimated_value: Number.isFinite(body.estimated_value) ? Number(body.estimated_value) : 0,
    notes: body.notes?.trim() || null,
    intent_score: Number.isFinite(body.intent_score) ? Math.max(0, Math.min(100, Math.round(Number(body.intent_score)))) : 0,
    customer_name: body.customer_name?.trim() || null,
    customer_phone: body.customer_phone?.trim() || null,
    address: body.address?.trim() || null,
    city: body.city?.trim() || null,
    state: body.state?.trim() || null,
    postal_code: body.postal_code?.trim() || null
  };

  const { data: inserted, error: insertError } = await supabase.from("jobs").insert(payload).select("id").single();
  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message || "Could not create job" }, { status: 400 });
  }

  await supabase.from("lead_jobs").upsert(
    {
      account_id: accountId,
      lead_id: body.lead_id,
      job_id: inserted.id
    },
    { onConflict: "account_id,lead_id" }
  );

  await supabase
    .from("leads")
    .update({ converted_job_id: inserted.id, status: "scheduled", stage: "BOOKED" })
    .eq("account_id", accountId)
    .eq("id", body.lead_id);

  return NextResponse.json({ jobId: inserted.id }, { status: 201 });
}
