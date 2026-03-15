import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logV2AuditEvent } from "@/lib/v2/audit";

function authorized(req: NextRequest) {
  const expected = process.env.WEBHOOK_SHARED_SECRET;
  if (!expected) return true;
  const received = req.headers.get("x-servicebutler-signature") || "";
  return received === expected;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    tenantId?: string;
    assignmentId?: string;
    status?: "accepted" | "rejected" | "complete";
  };

  if (!body.tenantId || !body.assignmentId || !body.status) {
    return NextResponse.json({ error: "tenantId, assignmentId, and status are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  const patch: Record<string, unknown> = {};
  if (body.status === "accepted") {
    patch.status = "accepted";
    patch.accepted_at = new Date().toISOString();
  } else if (body.status === "rejected") {
    patch.status = "rejected";
    patch.escalated_at = new Date().toISOString();
  } else {
    patch.status = "complete";
    patch.completed_at = new Date().toISOString();
  }

  const { data: updated, error } = await supabase
    .from("v2_assignments")
    .update(patch)
    .eq("tenant_id", body.tenantId)
    .eq("id", body.assignmentId)
    .select("id,status,opportunity_id")
    .single();

  if (error || !updated) return NextResponse.json({ error: error?.message || "Assignment not found" }, { status: 404 });

  await supabase
    .from("v2_opportunities")
    .update({ routing_status: body.status === "rejected" ? "escalated" : body.status === "complete" ? "complete" : "routed" })
    .eq("id", updated.opportunity_id)
    .eq("tenant_id", body.tenantId);

  await logV2AuditEvent({
    tenantId: body.tenantId,
    actorType: "webhook",
    actorId: "assignment.status",
    entityType: "assignment",
    entityId: body.assignmentId,
    action: `assignment_${body.status}`,
    before: null,
    after: { status: body.status }
  });

  return NextResponse.json({ received: true, assignment: updated });
}
