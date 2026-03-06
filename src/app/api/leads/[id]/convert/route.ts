import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { convertDemoLeadToJob } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/services/review-mode";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isDemoMode()) {
    const result = convertDemoLeadToJob(id);
    if (!result) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  }

  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id,status,stage,service_type,name,phone,address,city,state,postal_code,requested_timeframe,converted_job_id")
    .eq("account_id", accountId)
    .eq("id", id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (lead.converted_job_id) {
    return NextResponse.json({ jobId: lead.converted_job_id, created: false });
  }

  const { data: relation } = await supabase
    .from("lead_jobs")
    .select("job_id")
    .eq("account_id", accountId)
    .eq("lead_id", id)
    .maybeSingle();

  if (relation?.job_id) {
    await supabase.from("leads").update({ converted_job_id: relation.job_id }).eq("account_id", accountId).eq("id", id);
    return NextResponse.json({ jobId: relation.job_id, created: false });
  }

  const scheduledFor = lead.requested_timeframe?.toLowerCase().includes("today")
    ? new Date(new Date().setHours(14, 0, 0, 0)).toISOString()
    : lead.requested_timeframe?.toLowerCase().includes("tomorrow")
      ? new Date(new Date().setDate(new Date().getDate() + 1)).toISOString()
      : null;

  const { data: signals } = await supabase.from("lead_intent_signals").select("score").eq("lead_id", id);
  const intent = (signals || []).length
    ? Math.round((signals || []).reduce((sum, row) => sum + (Number(row.score) || 0), 0) / (signals || []).length)
    : 0;

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      account_id: accountId,
      lead_id: id,
      status: "SCHEDULED",
      pipeline_status: "NEW",
      scheduled_for: scheduledFor,
      service_type: lead.service_type,
      customer_name: lead.name,
      customer_phone: lead.phone,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      postal_code: lead.postal_code,
      notes: "Converted from lead inbox",
      intent_score: intent,
      estimated_value: 0
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message || "Could not convert lead" }, { status: 400 });
  }

  await supabase.from("lead_jobs").insert({
    account_id: accountId,
    lead_id: id,
    job_id: job.id
  });

  await supabase
    .from("leads")
    .update({ converted_job_id: job.id, status: "scheduled", stage: "BOOKED" })
    .eq("account_id", accountId)
    .eq("id", id);

  return NextResponse.json({ jobId: job.id, created: true });
}
