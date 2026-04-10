import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { getV2TenantContext } from "@/lib/v2/context";
import { mergeDispatchableOutreachSummary, type DispatchableLeadFollowUpState } from "@/lib/v2/dispatchable-outreach";
import { convertOpportunityToJobV2 } from "@/lib/v2/opportunity-conversion";
import { logV2AuditEvent } from "@/lib/v2/audit";
import type { AccountRole } from "@/types/domain";

const ALLOWED_STATES = new Set<DispatchableLeadFollowUpState>(["replied", "follow_up_needed", "booked"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await getV2TenantContext().catch(() => null);
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { state?: DispatchableLeadFollowUpState };
  const nextState = body.state;
  if (!nextState || !ALLOWED_STATES.has(nextState)) {
    return NextResponse.json({ error: "state must be replied, follow_up_needed, or booked" }, { status: 400 });
  }

  const { data: opportunity, error } = await context.supabase
    .from("v2_opportunities")
    .select("id,lifecycle_status,contact_status,explainability_json")
    .eq("tenant_id", context.franchiseTenantId)
    .eq("id", id)
    .maybeSingle();

  if (error || !opportunity?.id) return NextResponse.json({ error: error?.message || "Opportunity not found" }, { status: 404 });

  if (nextState === "booked") {
    const result = await convertOpportunityToJobV2({
      supabase: context.supabase as never,
      tenantId: context.franchiseTenantId,
      opportunityId: id,
      actorUserId: context.userId
    });

    const explainability = mergeDispatchableOutreachSummary(opportunity.explainability_json, {
      follow_up_state: "booked"
    });
    await context.supabase
      .from("v2_opportunities")
      .update({ explainability_json: explainability })
      .eq("tenant_id", context.franchiseTenantId)
      .eq("id", id);

    return NextResponse.json({ updated: true, state: "booked", ...result });
  }

  const explainability = mergeDispatchableOutreachSummary(opportunity.explainability_json, {
    follow_up_state: nextState,
    outreach_last_status: nextState === "replied" ? "replied" : asText(asRecord(opportunity.explainability_json).outreach_last_status) || "sent"
  });

  const { data: updated, error: updateError } = await context.supabase
    .from("v2_opportunities")
    .update({
      lifecycle_status: "contacted",
      explainability_json: explainability
    })
    .eq("tenant_id", context.franchiseTenantId)
    .eq("id", id)
    .select("id,lifecycle_status,explainability_json")
    .single();

  if (updateError || !updated?.id) {
    return NextResponse.json({ error: updateError?.message || "Could not update opportunity state" }, { status: 400 });
  }

  await logV2AuditEvent({
    tenantId: context.franchiseTenantId,
    actorType: "user",
    actorId: context.userId,
    entityType: "opportunity",
    entityId: id,
    action: "dispatchable_follow_up_state_updated",
    before: null,
    after: { state: nextState }
  });

  return NextResponse.json({
    updated: true,
    state: nextState,
    opportunity: {
      id: updated.id,
      lifecycle_status: updated.lifecycle_status,
      explainability: updated.explainability_json
    }
  });
}
