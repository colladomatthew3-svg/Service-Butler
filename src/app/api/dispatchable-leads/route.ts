import { NextRequest, NextResponse } from "next/server";
import { getV2TenantContext } from "@/lib/v2/context";
import { deriveDispatchableLeadCandidate } from "@/lib/v2/dispatchable-leads";

function asText(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(req: NextRequest) {
  const v2Context = await getV2TenantContext().catch(() => null);
  if (!v2Context) {
    return NextResponse.json({
      leads: [],
      summary: {
        dispatchable_count: 0,
        blocked_count: 0,
        recent_real_candidate_count: 0,
        live_ingestion_paths: []
      },
      warning: "Dispatchable leads are only available when the v2 operator tenant is configured."
    });
  }

  const sourceTypeFilter = String(req.nextUrl.searchParams.get("sourceType") || "").trim().toLowerCase();
  const limit = 150;
  const { data: opportunities, error } = await v2Context.supabase
    .from("v2_opportunities")
    .select(
      "id,source_event_id,opportunity_type,service_line,title,description,location_text,postal_code,routing_status,lifecycle_status,contact_status,source_reliability_score,explainability_json,created_at"
    )
    .eq("tenant_id", v2Context.franchiseTenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const opportunityRows = (opportunities || []) as Array<Record<string, unknown>>;
  const opportunityIds = opportunityRows.map((row) => asText(row.id)).filter(Boolean);
  const sourceEventIds = Array.from(new Set(opportunityRows.map((row) => asText(row.source_event_id)).filter(Boolean)));

  const [assignmentResult, sourceEventResult] = await Promise.all([
    opportunityIds.length > 0
      ? v2Context.supabase
          .from("v2_assignments")
          .select("id,opportunity_id,status,assigned_tenant_id,sla_due_at,assignment_reason,created_at")
          .eq("tenant_id", v2Context.franchiseTenantId)
          .in("opportunity_id", opportunityIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    sourceEventIds.length > 0
      ? v2Context.supabase
          .from("v2_source_events")
          .select("id,source_id,connector_run_id,occurred_at,ingested_at,compliance_status,normalized_payload")
          .eq("tenant_id", v2Context.franchiseTenantId)
          .in("id", sourceEventIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (assignmentResult.error) return NextResponse.json({ error: assignmentResult.error.message }, { status: 400 });
  if (sourceEventResult.error) return NextResponse.json({ error: sourceEventResult.error.message }, { status: 400 });

  const latestAssignmentByOpportunity = new Map<string, Record<string, unknown>>();
  for (const assignment of (assignmentResult.data || []) as Array<Record<string, unknown>>) {
    const opportunityId = asText(assignment.opportunity_id);
    if (opportunityId && !latestAssignmentByOpportunity.has(opportunityId)) {
      latestAssignmentByOpportunity.set(opportunityId, assignment);
    }
  }

  const sourceEventById = new Map<string, Record<string, unknown>>();
  const sourceIds = new Set<string>();
  const connectorRunIds = new Set<string>();
  for (const sourceEvent of (sourceEventResult.data || []) as Array<Record<string, unknown>>) {
    const id = asText(sourceEvent.id);
    if (id) sourceEventById.set(id, sourceEvent);
    const sourceId = asText(sourceEvent.source_id);
    const connectorRunId = asText(sourceEvent.connector_run_id);
    if (sourceId) sourceIds.add(sourceId);
    if (connectorRunId) connectorRunIds.add(connectorRunId);
  }

  const [sourceResult, connectorRunResult] = await Promise.all([
    sourceIds.size > 0
      ? v2Context.supabase
          .from("v2_data_sources")
          .select("id,source_type,name,status,terms_status,compliance_status,rollout_state,readiness_status,health_status,freshness_timestamp,freshness_sla_minutes,provenance")
          .eq("tenant_id", v2Context.franchiseTenantId)
          .in("id", Array.from(sourceIds))
      : Promise.resolve({ data: [], error: null }),
    connectorRunIds.size > 0
      ? v2Context.supabase
          .from("v2_connector_runs")
          .select("id,status,metadata")
          .eq("tenant_id", v2Context.franchiseTenantId)
          .in("id", Array.from(connectorRunIds))
      : Promise.resolve({ data: [], error: null })
  ]);

  if (sourceResult.error) return NextResponse.json({ error: sourceResult.error.message }, { status: 400 });
  if (connectorRunResult.error) return NextResponse.json({ error: connectorRunResult.error.message }, { status: 400 });

  const sourceById = new Map<string, Record<string, unknown>>();
  for (const source of (sourceResult.data || []) as Array<Record<string, unknown>>) {
    sourceById.set(asText(source.id), source);
  }

  const connectorRunById = new Map<string, Record<string, unknown>>();
  for (const connectorRun of (connectorRunResult.data || []) as Array<Record<string, unknown>>) {
    connectorRunById.set(asText(connectorRun.id), connectorRun);
  }

  const leads = opportunityRows.map((opportunity) => {
    const sourceEvent = sourceEventById.get(asText(opportunity.source_event_id)) || null;
    const source = sourceEvent ? sourceById.get(asText(sourceEvent.source_id)) || null : null;
    const connectorRun = sourceEvent ? connectorRunById.get(asText(sourceEvent.connector_run_id)) || null : null;
    const assignment = latestAssignmentByOpportunity.get(asText(opportunity.id)) || null;
    return deriveDispatchableLeadCandidate({
      opportunity,
      sourceEvent,
      source,
      connectorRun,
      assignment
    });
  });

  const filteredLeads = sourceTypeFilter
    ? leads.filter((lead) => (lead.source_type || "").toLowerCase() === sourceTypeFilter)
    : leads;

  const sortedLeads = [...filteredLeads].sort((left, right) => {
    if (Number(right.dispatch_eligible) !== Number(left.dispatch_eligible)) {
      return Number(right.dispatch_eligible) - Number(left.dispatch_eligible);
    }
    return new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime();
  });

  const liveIngestionPaths = Array.from(
    new Set(
      sortedLeads
        .filter((lead) => lead.counts_as_real_capture)
        .map((lead) => lead.source_type || lead.source || "")
        .filter(Boolean)
    )
  );

  return NextResponse.json({
    leads: sortedLeads,
    summary: {
      dispatchable_count: sortedLeads.filter((lead) => lead.dispatch_eligible).length,
      blocked_count: sortedLeads.filter((lead) => !lead.dispatch_eligible).length,
      recent_real_candidate_count: sortedLeads.filter((lead) => lead.counts_as_real_capture).length,
      live_ingestion_paths: liveIngestionPaths,
      blocked_reason_counts: sortedLeads
        .filter((lead) => !lead.dispatch_eligible && lead.blocked_reason)
        .reduce<Record<string, number>>((acc, lead) => {
          const key = String(lead.blocked_reason || "");
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
    }
  });
}
