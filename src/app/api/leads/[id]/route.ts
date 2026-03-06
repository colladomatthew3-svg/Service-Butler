import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { getDemoLead, getDemoLeadSignals, updateDemoLead } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/services/review-mode";

function statusToStage(status?: string | null) {
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
      return undefined;
  }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isDemoMode()) {
    const lead = getDemoLead(id);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json({ lead, signals: getDemoLeadSignals(id) });
  }

  const { accountId, supabase } = await getCurrentUserContext();

  const { data: lead, error } = await supabase
    .from("leads")
    .select(
      "id,created_at,status,name,phone,service_type,address,city,state,postal_code,requested_timeframe,source,notes,scheduled_for,converted_job_id"
    )
    .eq("account_id", accountId)
    .eq("id", id)
    .single();

  if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const { data: signals } = await supabase
    .from("lead_intent_signals")
    .select("id,created_at,signal_type,title,detail,score,payload")
    .eq("lead_id", id)
    .order("score", { ascending: false });

  return NextResponse.json({ lead, signals: signals || [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as {
    status?: string;
    notes?: string | null;
    scheduled_for?: string | null;
  };

  if (isDemoMode()) {
    const patch: Record<string, unknown> = {};
    if (body.status) {
      patch.status = body.status;
      const stage = statusToStage(body.status);
      if (stage) patch.stage = stage;
    }
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.scheduled_for !== undefined) {
      patch.scheduled_for = body.scheduled_for ? new Date(body.scheduled_for).toISOString() : null;
    }

    const lead = updateDemoLead(id, patch);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json({
      lead: {
        id: lead.id,
        status: lead.status,
        notes: lead.notes,
        scheduled_for: lead.scheduled_for
      }
    });
  }

  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const patch: Record<string, unknown> = {};
  if (body.status) {
    patch.status = body.status;
    const stage = statusToStage(body.status);
    if (stage) patch.stage = stage;
  }
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.scheduled_for !== undefined) {
    patch.scheduled_for = body.scheduled_for ? new Date(body.scheduled_for).toISOString() : null;
  }

  const { data, error } = await supabase
    .from("leads")
    .update(patch)
    .eq("account_id", accountId)
    .eq("id", id)
    .select("id,status,notes,scheduled_for")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ lead: data });
}
