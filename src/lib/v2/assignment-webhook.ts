import { logV2AuditEvent } from "@/lib/v2/audit";
import { transitionAssignmentV2 } from "@/lib/v2/routing-engine";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function applyAssignmentWebhookStatus(input: {
  supabase: SupabaseClient;
  tenantId: string;
  assignmentId: string;
  status: "accepted" | "rejected" | "complete";
  transitionAssignment?: typeof transitionAssignmentV2;
}) {
  const transitionAssignment = input.transitionAssignment || transitionAssignmentV2;

  if (input.status === "accepted") {
    const assignment = await transitionAssignment({
      supabase: input.supabase,
      tenantId: input.tenantId,
      assignmentId: input.assignmentId,
      action: "accept",
      actorUserId: "webhook:assignment.status"
    });

    return {
      received: true,
      assignment
    };
  }

  if (input.status === "rejected") {
    const assignment = await transitionAssignment({
      supabase: input.supabase,
      tenantId: input.tenantId,
      assignmentId: input.assignmentId,
      action: "reject",
      actorUserId: "webhook:assignment.status"
    });

    return {
      received: true,
      assignment
    };
  }

  const { data: updated, error } = await input.supabase
    .from("v2_assignments")
    .update({
      status: "complete",
      completed_at: new Date().toISOString()
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.assignmentId)
    .select("id,status,opportunity_id,completed_at")
    .single();

  if (error || !updated) {
    throw new Error(error?.message || "Assignment not found");
  }

  await input.supabase
    .from("v2_opportunities")
    .update({ routing_status: "complete" })
    .eq("id", updated.opportunity_id)
    .eq("tenant_id", input.tenantId);

  await logV2AuditEvent({
    tenantId: input.tenantId,
    actorType: "webhook",
    actorId: "assignment.status",
    entityType: "assignment",
    entityId: input.assignmentId,
    action: "assignment_complete",
    before: null,
    after: { status: "complete" }
  });

  return {
    received: true,
    assignment: updated
  };
}
