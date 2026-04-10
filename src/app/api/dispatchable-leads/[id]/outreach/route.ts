import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { getV2TenantContext, resolveV2OwnerUserForTenant } from "@/lib/v2/context";
import { deriveDispatchableLeadCandidate } from "@/lib/v2/dispatchable-leads";
import { triggerDispatchableLeadOutreach } from "@/lib/v2/dispatchable-outreach";
import type { AccountRole } from "@/types/domain";

function asText(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getV2TenantContext().catch(() => null);
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const { id } = await params;
  const { data: opportunity, error } = await context.supabase
    .from("v2_opportunities")
    .select("id,source_event_id,opportunity_type,service_line,title,description,location_text,postal_code,routing_status,lifecycle_status,contact_status,source_reliability_score,explainability_json,created_at")
    .eq("tenant_id", context.franchiseTenantId)
    .eq("id", id)
    .maybeSingle();

  if (error || !opportunity?.id) return NextResponse.json({ error: error?.message || "Opportunity not found" }, { status: 404 });

  const sourceEventId = asText(opportunity.source_event_id);
  const [{ data: sourceEvent }, { data: lead }] = await Promise.all([
    sourceEventId
      ? context.supabase
          .from("v2_source_events")
          .select("id,source_id,connector_run_id,occurred_at,ingested_at,compliance_status,normalized_payload")
          .eq("tenant_id", context.franchiseTenantId)
          .eq("id", sourceEventId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    context.supabase
      .from("v2_leads")
      .select("id,opportunity_id,do_not_contact,contact_channels_json,created_at")
      .eq("tenant_id", context.franchiseTenantId)
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const sourceId = asText(sourceEvent?.source_id);
  const connectorRunId = asText(sourceEvent?.connector_run_id);
  const [{ data: source }, { data: connectorRun }, { data: latestOutreachEvent }] = await Promise.all([
    sourceId
      ? context.supabase
          .from("v2_data_sources")
          .select("id,source_type,name,status,terms_status,compliance_status,rollout_state,readiness_status,health_status,freshness_timestamp,freshness_sla_minutes,provenance")
          .eq("tenant_id", context.franchiseTenantId)
          .eq("id", sourceId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    connectorRunId
      ? context.supabase
          .from("v2_connector_runs")
          .select("id,status,metadata")
          .eq("tenant_id", context.franchiseTenantId)
          .eq("id", connectorRunId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    lead?.id
      ? context.supabase
          .from("v2_outreach_events")
          .select("id,lead_id,channel,event_type,outcome,provider_message_id,sent_at,response_at,created_at,metadata")
          .eq("tenant_id", context.franchiseTenantId)
          .eq("lead_id", asText(lead.id))
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  const candidate = deriveDispatchableLeadCandidate({
    opportunity: opportunity as Record<string, unknown>,
    sourceEvent: (sourceEvent || null) as Record<string, unknown> | null,
    source: (source || null) as Record<string, unknown> | null,
    connectorRun: (connectorRun || null) as Record<string, unknown> | null,
    lead: (lead || null) as Record<string, unknown> | null,
    latestOutreachEvent: (latestOutreachEvent || null) as Record<string, unknown> | null
  });

  const resolvedOwner = await resolveV2OwnerUserForTenant({
    supabase: context.supabase,
    accountId: context.accountId,
    userId: context.userId,
    franchiseTenantId: context.franchiseTenantId
  });

  if (!resolvedOwner?.ownerUserId) {
    return NextResponse.json(
      {
        sent: false,
        blocked: true,
        reason: "owner_user_unresolved",
        detail: "No valid tenant operator could be resolved for first-touch outreach."
      },
      { status: 422 }
    );
  }

  const result = await triggerDispatchableLeadOutreach({
    supabase: context.supabase as never,
    tenantId: context.franchiseTenantId,
    actorUserId: resolvedOwner.ownerUserId,
    actorResolutionSource: resolvedOwner.resolutionSource,
    franchiseVertical: context.franchiseVertical,
    opportunity: opportunity as Record<string, unknown>,
    candidate,
    existingLead: (lead || null) as Record<string, unknown> | null,
    latestOutreachEvent: (latestOutreachEvent || null) as Record<string, unknown> | null
  });

  if (result.blocked) {
    return NextResponse.json({ sent: false, blocked: true, reason: result.reason }, { status: 409 });
  }

  return NextResponse.json(result);
}
