import type { V2DashboardMetricRow } from "@/lib/v2/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function sourceCategoryFromSignal(sourceType: string) {
  const normalized = sourceType.toLowerCase();
  if (normalized.includes("weather") || normalized.includes("storm") || normalized.includes("hail") || normalized.includes("wind") || normalized.includes("freeze") || normalized.includes("flood")) return "weather_damage";
  if (normalized.includes("permit")) return "building_permits";
  if (normalized.includes("incident") || normalized.includes("fire") || normalized.includes("emergency") || normalized.includes("infrastructure")) {
    return "public_incident";
  }
  if (normalized.includes("reddit") || normalized.includes("google_review") || normalized.includes("distress") || normalized.includes("social")) {
    return "consumer_distress";
  }
  return "other";
}

function collectSourceTypes(explainability: Record<string, unknown>) {
  if (Array.isArray(explainability.source_types)) {
    return explainability.source_types.map((value) => String(value || "").trim()).filter(Boolean);
  }
  if (typeof explainability.source_type === "string" && explainability.source_type.trim()) {
    return [explainability.source_type.trim()];
  }
  return [];
}

function isDistressOpportunity(row: Record<string, unknown>) {
  const opportunityType = String(row.opportunity_type || "").toLowerCase();
  if (opportunityType.includes("distress")) return true;
  const explainability = asRecord(row.explainability_json);
  return collectSourceTypes(explainability).some((type) => sourceCategoryFromSignal(type) === "consumer_distress");
}

export async function getCorporateDashboardReadModel({
  supabase,
  enterpriseTenantId
}: {
  supabase: SupabaseClient;
  enterpriseTenantId: string;
}) {
  const { data: franchises } = await supabase
    .from("v2_tenants")
    .select("id,name")
    .eq("parent_tenant_id", enterpriseTenantId)
    .eq("type", "franchise")
    .limit(500);

  const franchiseIds = (franchises || []).map((row: Record<string, unknown>) => String(row.id));

  const [{ data: opportunities }, { data: assignments }, { data: jobs }, { data: connectorRuns }] = await Promise.all([
    franchiseIds.length
      ? supabase
          .from("v2_opportunities")
          .select(
            "tenant_id,opportunity_type,service_line,incident_cluster_id,routing_status,lifecycle_status,catastrophe_linkage_score,explainability_json,created_at"
          )
          .in("tenant_id", franchiseIds)
      : Promise.resolve({ data: [] }),
    franchiseIds.length
      ? supabase.from("v2_assignments").select("tenant_id,status,sla_due_at,accepted_at")
          .in("tenant_id", franchiseIds)
      : Promise.resolve({ data: [] }),
    franchiseIds.length
      ? supabase.from("v2_jobs").select("tenant_id,status,revenue_amount,booked_at").in("tenant_id", franchiseIds)
      : Promise.resolve({ data: [] }),
    franchiseIds.length
      ? supabase.from("v2_connector_runs").select("tenant_id,status,started_at,completed_at").in("tenant_id", franchiseIds)
      : Promise.resolve({ data: [] })
  ]);

  const oppRows = (opportunities || []) as Array<Record<string, unknown>>;
  const assignmentRows = (assignments || []) as Array<Record<string, unknown>>;
  const jobRows = (jobs || []) as Array<Record<string, unknown>>;
  const connectorRows = (connectorRuns || []) as Array<Record<string, unknown>>;

  const totalOpportunities = oppRows.length;
  const routed = oppRows.filter((row) => row.routing_status === "routed" || row.routing_status === "escalated").length;
  const catastrophe = oppRows.filter((row) => toNumber(row.catastrophe_linkage_score) >= 70).length;
  const multiSignalCount = oppRows.filter((row) => Boolean(asRecord(row.explainability_json).multi_signal)).length;
  const clusterLinkedCount = oppRows.filter((row) => Boolean(row.incident_cluster_id)).length;
  const distressCount = oppRows.filter((row) => isDistressOpportunity(row)).length;

  const sourceMixByCategory = oppRows.reduce((acc: Record<string, number>, row) => {
    const explainability = asRecord(row.explainability_json);
    const sourceTypes = collectSourceTypes(explainability);
    const categories = sourceTypes.length > 0 ? sourceTypes.map(sourceCategoryFromSignal) : ["other"];
    for (const category of categories) {
      acc[category] = (acc[category] || 0) + 1;
    }
    return acc;
  }, {});

  const opportunitiesByServiceLine = oppRows.reduce((acc: Record<string, number>, row) => {
    const serviceLine = String(row.service_line || "general");
    acc[serviceLine] = (acc[serviceLine] || 0) + 1;
    return acc;
  }, {});

  const bookedJobs = jobRows.filter((row) => String(row.status || "").includes("book")).length;
  const totalRevenue = jobRows.reduce((sum, row) => sum + toNumber(row.revenue_amount), 0);

  const acceptedAssignments = assignmentRows.filter((row) => row.status === "accepted").length;
  const overdueAssignments = assignmentRows.filter((row) => {
    if (!row.sla_due_at) return false;
    if (row.status === "accepted" || row.status === "complete") return false;
    return new Date(String(row.sla_due_at)).getTime() < Date.now();
  }).length;

  const completedConnectorRuns = connectorRows.filter((row) => row.status === "completed" || row.status === "partial").length;
  const failedConnectorRuns = connectorRows.filter((row) => row.status === "failed").length;

  const metrics: V2DashboardMetricRow[] = [
    { label: "opportunity_volume", value: totalOpportunities },
    { label: "routed_opportunities", value: routed },
    { label: "booked_jobs", value: bookedJobs },
    { label: "assignment_acceptances", value: acceptedAssignments },
    { label: "assignment_overdue", value: overdueAssignments },
    { label: "catastrophe_surge_signals", value: catastrophe },
    { label: "multi_signal_opportunities", value: multiSignalCount },
    { label: "cluster_linked_opportunities", value: clusterLinkedCount },
    { label: "distress_signal_opportunities", value: distressCount },
    { label: "connector_runs_completed", value: completedConnectorRuns },
    { label: "connector_runs_failed", value: failedConnectorRuns },
    { label: "estimated_revenue", value: totalRevenue }
  ];

  const byFranchise = (franchises || []).map((franchise: Record<string, unknown>) => {
    const id = String(franchise.id);
    const name = String(franchise.name || "Franchise");

    const opp = oppRows.filter((row) => String(row.tenant_id) === id).length;
    const booked = jobRows.filter((row) => String(row.tenant_id) === id && String(row.status || "").includes("book")).length;
    const bookingRate = opp > 0 ? Number(((booked / opp) * 100).toFixed(2)) : 0;

    return { tenant_id: id, franchise: name, opportunities: opp, booked_jobs: booked, booking_rate: bookingRate };
  });

  return {
    metrics,
    byFranchise,
    intelligence: {
      source_mix_by_category: sourceMixByCategory,
      opportunities_by_service_line: opportunitiesByServiceLine,
      multi_signal_opportunities: multiSignalCount,
      cluster_linked_opportunities: clusterLinkedCount,
      distress_signal_opportunities: distressCount
    },
    freshness: {
      generated_at: new Date().toISOString(),
      data_sources: completedConnectorRuns + failedConnectorRuns
    }
  };
}

export async function getFranchiseDashboardReadModel({
  supabase,
  franchiseTenantId
}: {
  supabase: SupabaseClient;
  franchiseTenantId: string;
}) {
  const [
    { data: opportunities },
    { data: assignments },
    { data: jobs },
    { data: outreachEvents },
    { data: territories },
    { data: dataSources },
    { data: connectorRuns }
  ] = await Promise.all([
    supabase
      .from("v2_opportunities")
      .select(
        "id,title,opportunity_type,service_line,postal_code,urgency_score,job_likelihood_score,catastrophe_linkage_score,incident_cluster_id,explainability_json,routing_status,lifecycle_status,created_at"
      )
      .eq("tenant_id", franchiseTenantId)
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("v2_assignments")
      .select("id,opportunity_id,status,metadata,sla_due_at,assigned_at,accepted_at")
      .eq("tenant_id", franchiseTenantId)
      .order("assigned_at", { ascending: false })
      .limit(200),
    supabase
      .from("v2_jobs")
      .select("id,status,revenue_amount,booked_at,scheduled_at")
      .eq("tenant_id", franchiseTenantId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("v2_outreach_events")
      .select("id,channel,event_type,outcome,created_at")
      .eq("tenant_id", franchiseTenantId)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("v2_territories")
      .select("id,name,zip_codes")
      .eq("tenant_id", franchiseTenantId)
      .eq("active", true)
      .limit(200),
    supabase
      .from("v2_data_sources")
      .select("id,name,source_type,reliability_score,freshness_timestamp,terms_status,status")
      .eq("tenant_id", franchiseTenantId)
      .limit(100),
    supabase
      .from("v2_connector_runs")
      .select("id,source_id,status,completed_at,records_seen,records_created,metadata")
      .eq("tenant_id", franchiseTenantId)
      .order("completed_at", { ascending: false })
      .limit(300)
  ]);

  const oppRows = (opportunities || []) as Array<Record<string, unknown>>;
  const assignmentRows = (assignments || []) as Array<Record<string, unknown>>;
  const jobRows = (jobs || []) as Array<Record<string, unknown>>;
  const outreachRows = (outreachEvents || []) as Array<Record<string, unknown>>;
  const territoryRows = (territories || []) as Array<Record<string, unknown>>;
  const sourceRows = (dataSources || []) as Array<Record<string, unknown>>;
  const connectorRows = (connectorRuns || []) as Array<Record<string, unknown>>;

  const hotOpportunities = oppRows.filter((row) => toNumber(row.urgency_score) >= 70 || toNumber(row.job_likelihood_score) >= 70).length;
  const multiSignalCount = oppRows.filter((row) => Boolean(asRecord(row.explainability_json).multi_signal)).length;
  const clusterLinkedCount = oppRows.filter((row) => Boolean(row.incident_cluster_id)).length;
  const distressCount = oppRows.filter((row) => isDistressOpportunity(row)).length;
  const opportunitiesByServiceLine = oppRows.reduce((acc: Record<string, number>, row) => {
    const key = String(row.service_line || "general");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const sourceMixByCategory = oppRows.reduce((acc: Record<string, number>, row) => {
    const explainability = asRecord(row.explainability_json);
    const sourceTypes = collectSourceTypes(explainability);
    const categories = sourceTypes.length > 0 ? sourceTypes.map(sourceCategoryFromSignal) : ["other"];
    for (const category of categories) {
      acc[category] = (acc[category] || 0) + 1;
    }
    return acc;
  }, {});
  const tasksDue = assignmentRows.filter((row) => {
    if (!row.sla_due_at) return false;
    if (row.status === "accepted" || row.status === "complete") return false;
    return new Date(String(row.sla_due_at)).getTime() <= Date.now();
  }).length;

  const bookedJobs = jobRows.filter((row) => String(row.status || "").includes("book")).length;
  const outreachSent = outreachRows.filter((row) => row.event_type === "sent" || row.event_type === "delivered").length;
  const activeOpportunities = oppRows.filter(
    (row) => !["booked_job", "closed_lost"].includes(String(row.lifecycle_status || ""))
  );
  const assignedOpportunities = oppRows.filter((row) => {
    const lifecycle = String(row.lifecycle_status || "");
    const routing = String(row.routing_status || "");
    return lifecycle === "assigned" || routing === "routed" || routing === "escalated";
  });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const jobsBookedToday = jobRows.filter((row) => {
    if (!String(row.status || "").includes("book")) return false;
    if (!row.booked_at) return false;
    return new Date(String(row.booked_at)).getTime() >= startOfDay.getTime();
  });

  const outreachActivity = outreachRows.reduce(
    (
      acc: { total: number; by_channel: Record<string, { sent: number; replied: number; failed: number; skipped: number }> },
      row
    ) => {
      const channel = String(row.channel || "unknown");
      if (!acc.by_channel[channel]) {
        acc.by_channel[channel] = { sent: 0, replied: 0, failed: 0, skipped: 0 };
      }
      const eventType = String(row.event_type || "");
      if (eventType === "sent" || eventType === "delivered") acc.by_channel[channel].sent += 1;
      if (eventType === "replied") acc.by_channel[channel].replied += 1;
      if (eventType === "failed") acc.by_channel[channel].failed += 1;
      if (eventType === "skipped") acc.by_channel[channel].skipped += 1;
      return acc;
    },
    { total: outreachRows.length, by_channel: {} as Record<string, { sent: number; replied: number; failed: number; skipped: number }> }
  );

  const opportunitiesById = new Map<string, Record<string, unknown>>();
  for (const opportunity of oppRows) {
    opportunitiesById.set(String(opportunity.id), opportunity);
  }

  const territoriesById = new Map<string, Record<string, unknown>>();
  for (const territory of territoryRows) {
    territoriesById.set(String(territory.id), territory);
  }

  const territoryPerformanceMap = new Map<
    string,
    { territory_id: string; territory_name: string; assignments: number; accepted: number; escalated: number; completed: number }
  >();

  function getTerritoryFromOpportunityPostal(opportunityId: string) {
    const opportunity = opportunitiesById.get(opportunityId);
    const postalCode = String(opportunity?.postal_code || "").trim();
    if (!postalCode) return null;
    return (
      territoryRows.find((territory) => {
        const zips = Array.isArray(territory.zip_codes) ? territory.zip_codes.map((zip) => String(zip)) : [];
        return zips.includes(postalCode);
      }) || null
    );
  }

  for (const assignment of assignmentRows) {
    const metadata = (assignment.metadata || {}) as Record<string, unknown>;
    const metadataTerritoryId = String(metadata.territory_id || "").trim();
    const opportunityId = String(assignment.opportunity_id || "").trim();

    const matchedTerritory =
      (metadataTerritoryId ? territoriesById.get(metadataTerritoryId) : null) ||
      (opportunityId ? getTerritoryFromOpportunityPostal(opportunityId) : null);

    if (!matchedTerritory?.id) continue;

    const territoryId = String(matchedTerritory.id);
    const current =
      territoryPerformanceMap.get(territoryId) ||
      {
        territory_id: territoryId,
        territory_name: String(matchedTerritory.name || territoryId),
        assignments: 0,
        accepted: 0,
        escalated: 0,
        completed: 0
      };

    current.assignments += 1;
    const status = String(assignment.status || "");
    if (status === "accepted") current.accepted += 1;
    if (status === "escalated") current.escalated += 1;
    if (status === "complete") current.completed += 1;

    territoryPerformanceMap.set(territoryId, current);
  }

  const latestRunBySource = new Map<string, Record<string, unknown>>();
  for (const run of connectorRows) {
    const sourceId = String(run.source_id || "");
    if (!sourceId) continue;
    if (!latestRunBySource.has(sourceId)) {
      latestRunBySource.set(sourceId, run);
    }
  }

  const sourceFreshness = sourceRows.map((source) => {
    const sourceId = String(source.id || "");
    const latestRun = latestRunBySource.get(sourceId);
    return {
      source_id: sourceId,
      name: String(source.name || "source"),
      source_type: String(source.source_type || "unknown"),
      terms_status: String(source.terms_status || "unknown"),
      status: String(source.status || "unknown"),
      reliability_score: toNumber(source.reliability_score),
      freshness_timestamp: source.freshness_timestamp || null,
      latest_run_status: latestRun ? String(latestRun.status || "unknown") : null,
      latest_run_completed_at: latestRun?.completed_at || null,
      latest_records_seen: latestRun ? toNumber(latestRun.records_seen) : 0,
      latest_records_created: latestRun ? toNumber(latestRun.records_created) : 0
    };
  });

  return {
    metrics: [
      { label: "new_opportunities", value: oppRows.length },
      { label: "hot_opportunities", value: hotOpportunities },
      { label: "multi_signal_opportunities", value: multiSignalCount },
      { label: "cluster_linked_opportunities", value: clusterLinkedCount },
      { label: "distress_signal_opportunities", value: distressCount },
      { label: "tasks_due", value: tasksDue },
      { label: "booked_jobs", value: bookedJobs },
      { label: "outreach_sent", value: outreachSent }
    ],
    funnel: {
      opportunities: oppRows.length,
      assigned: assignmentRows.filter((row) => row.status === "accepted" || row.status === "pending_acceptance").length,
      booked_jobs: bookedJobs
    },
    operator_readiness: {
      active_opportunities: activeOpportunities.length,
      assigned_opportunities: assignedOpportunities.length,
      jobs_booked_today: jobsBookedToday.length
    },
    opportunities: oppRows,
    opportunities_by_service_line: opportunitiesByServiceLine,
    source_mix_by_category: sourceMixByCategory,
    multi_signal_opportunities: multiSignalCount,
    cluster_linked_opportunities: clusterLinkedCount,
    distress_signal_opportunities: distressCount,
    active_opportunities: activeOpportunities,
    assigned_opportunities: assignedOpportunities,
    assignments: assignmentRows,
    jobs: jobRows,
    outreach_activity: outreachActivity,
    jobs_booked_today: jobsBookedToday,
    territory_performance: Array.from(territoryPerformanceMap.values()),
    source_freshness: sourceFreshness,
    freshness: {
      generated_at: new Date().toISOString(),
      outreach_events_considered: outreachRows.length,
      connector_runs_considered: connectorRows.length
    }
  };
}
