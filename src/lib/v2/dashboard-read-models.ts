import type { V2DashboardMetricRow } from "@/lib/v2/types";
import type { CaptureProofSummary } from "@/lib/v2/capture-proof";
import { getOpportunityQualificationSnapshot, isBuyerProofEligibleQualification } from "@/lib/v2/opportunity-qualification";
import { classifyProofAuthenticity, type ProofAuthenticity } from "@/lib/v2/proof-authenticity";
import type { SupabaseClient } from "@supabase/supabase-js";

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function asText(value: unknown) {
  return String(value ?? "").trim();
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

function sourceEventNormalized(sourceEvent: Record<string, unknown>) {
  return asRecord(sourceEvent.normalized_payload);
}

function sourceConfigForEvent(sourceEvent: Record<string, unknown>, sourceById?: Map<string, Record<string, unknown>>) {
  return sourceById?.get(asText(sourceEvent.source_id)) || {};
}

function sourceTypeForEvent(sourceEvent: Record<string, unknown>, sourceById?: Map<string, Record<string, unknown>>) {
  const normalized = sourceEventNormalized(sourceEvent);
  const sourceConfig = sourceConfigForEvent(sourceEvent, sourceById);
  return asText(sourceEvent.source_type || normalized.source_type || normalized.connector_key || sourceConfig.source_type || sourceEvent.event_type);
}

function sourceNameForEvent(sourceEvent: Record<string, unknown>, sourceById?: Map<string, Record<string, unknown>>) {
  const normalized = sourceEventNormalized(sourceEvent);
  const sourceConfig = sourceConfigForEvent(sourceEvent, sourceById);
  return asText(sourceEvent.source_name || normalized.source_name || normalized.provider || normalized.connector_name || sourceConfig.name || sourceTypeForEvent(sourceEvent, sourceById) || "unknown");
}

function sourceProvenanceForEvent(sourceEvent: Record<string, unknown>, sourceById?: Map<string, Record<string, unknown>>) {
  const normalized = sourceEventNormalized(sourceEvent);
  const sourceConfig = sourceConfigForEvent(sourceEvent, sourceById);
  return asText(sourceEvent.source_provenance || normalized.source_provenance || normalized.provider || normalized.source_url || sourceConfig.provenance);
}

function sourceFreshnessForEvent(sourceEvent: Record<string, unknown>) {
  const normalized = sourceEventNormalized(sourceEvent);
  return toNumber(sourceEvent.data_freshness_score ?? normalized.data_freshness_score, 0);
}

function isDistressOpportunity(row: Record<string, unknown>) {
  const opportunityType = String(row.opportunity_type || "").toLowerCase();
  if (opportunityType.includes("distress")) return true;
  const explainability = asRecord(row.explainability_json);
  return collectSourceTypes(explainability).some((type) => sourceCategoryFromSignal(type) === "consumer_distress");
}

function leadVerificationSnapshot(row: Record<string, unknown>) {
  const channels = asRecord(row.contact_channels_json);
  const verificationStatus = asText(channels.verification_status || row.lead_status || "").toLowerCase();
  const verificationScore = toNumber(channels.verification_score || 0);
  const phone = asText(channels.phone || "");
  const email = asText(channels.email || "");
  const reasons = Array.isArray(channels.verification_reasons)
    ? channels.verification_reasons.map((value) => asText(value)).filter(Boolean)
    : [];
  const contactable = Boolean(phone || email);
  const verified = verificationStatus === "verified" && verificationScore >= 70 && contactable;
  const review = verificationStatus === "review" || (!verified && contactable && verificationScore >= 45);
  const rejected = verificationStatus === "rejected" || (!verified && !review);

  return {
    verificationStatus,
    verificationScore,
    reasons,
    phone,
    email,
    contactable,
    verified,
    review,
    rejected
  };
}

function isNetworkActivatedLead(row: Record<string, unknown>) {
  const channels = asRecord(row.contact_channels_json);
  const provenance = asText(channels.contact_provenance).toLowerCase();
  const recordKind = asText(channels.record_kind).toLowerCase();
  const sourceType = asText(channels.source_type).toLowerCase();
  return (
    provenance.startsWith("network:") ||
    recordKind === "prospect" ||
    recordKind === "referral_partner" ||
    sourceType.includes("network")
  );
}

function proofAuthenticityForOpportunity(input: {
  opportunity: Record<string, unknown>;
  sourceEvent: Record<string, unknown>;
  connectorRunMetadata?: Record<string, unknown>;
  sourceById?: Map<string, Record<string, unknown>>;
}) {
  return classifyProofAuthenticity({
    sourceType: sourceTypeForEvent(input.sourceEvent, input.sourceById),
    sourceName: sourceNameForEvent(input.sourceEvent, input.sourceById),
    sourceProvenance: sourceProvenanceForEvent(input.sourceEvent, input.sourceById),
    normalizedPayload: asRecord(input.sourceEvent.normalized_payload),
    connectorRunMetadata: input.connectorRunMetadata
  });
}

function isBuyerProofEligibleOpportunity(input: {
  opportunity: Record<string, unknown>;
  sourceEvent: Record<string, unknown>;
  connectorRunMetadata?: Record<string, unknown>;
  sourceById?: Map<string, Record<string, unknown>>;
}) {
  const proofAuthenticity = proofAuthenticityForOpportunity(input);
  const qualification = getOpportunityQualificationSnapshot({
    explainability: asRecord(input.opportunity.explainability_json),
    proofAuthenticity
  });
  return isBuyerProofEligibleQualification(qualification);
}

function buildCaptureProofSummary(input: {
  franchiseTenantId: string;
  sourceEvents: Array<Record<string, unknown>>;
  opportunities: Array<Record<string, unknown>>;
  leads: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
  connectorRunById: Map<string, Record<string, unknown>>;
  sourceById?: Map<string, Record<string, unknown>>;
}) {
  const leadsByOpportunity = new Map<string, Record<string, unknown>[]>();
  for (const lead of input.leads) {
    const opportunityId = asText(lead.opportunity_id);
    if (!opportunityId) continue;
    const bucket = leadsByOpportunity.get(opportunityId) || [];
    bucket.push(lead);
    leadsByOpportunity.set(opportunityId, bucket);
  }

  const jobsByLead = new Map<string, Record<string, unknown>[]>();
  for (const job of input.jobs) {
    const leadId = asText(job.lead_id);
    if (!leadId) continue;
    const bucket = jobsByLead.get(leadId) || [];
    bucket.push(job);
    jobsByLead.set(leadId, bucket);
  }

  let sourceEventsCaptured = 0;
  let realSourceEventsCaptured = 0;
  let opportunitiesUpdated = 0;
  let realOpportunitiesCaptured = 0;
  let opportunitiesRequiringSdr = 0;
  let qualifiedContactableOpportunities = 0;
  let realCaptureOpportunityCount = 0;
  let realLeadsCreated = 0;
  let bookedJobsAttributed = 0;
  let simulatedCount = 0;
  let researchOnlyCount = 0;
  let countsAsRealLeadCount = 0;
  const opportunityAuthenticity = new Map<string, ProofAuthenticity>();
  const processedRuns = new Set<string>();

  for (const sourceEvent of input.sourceEvents) {
    const connectorRun = input.connectorRunById.get(asText(sourceEvent.connector_run_id));
    const connectorRunMetadata = asRecord(connectorRun?.metadata);
    const authenticity = classifyProofAuthenticity({
      sourceType: sourceTypeForEvent(sourceEvent, input.sourceById),
      sourceName: sourceNameForEvent(sourceEvent, input.sourceById),
      sourceProvenance: sourceProvenanceForEvent(sourceEvent, input.sourceById),
      normalizedPayload: asRecord(sourceEvent.normalized_payload),
      connectorRunMetadata
    });

    sourceEventsCaptured += 1;
    if (authenticity === "live_provider" || authenticity === "live_derived") {
      realSourceEventsCaptured += 1;
    } else if (authenticity === "synthetic") {
      simulatedCount += 1;
    }

    const runId = asText(sourceEvent.connector_run_id);
    if (runId && !processedRuns.has(runId)) {
      processedRuns.add(runId);
      opportunitiesUpdated += toNumber(connectorRunMetadata.opportunities_updated, 0);
    }
  }

  for (const opportunity of input.opportunities) {
    const sourceEvent = input.sourceEvents.find((row) => asText(row.id) === asText(opportunity.source_event_id)) || {};
    const connectorRun = input.connectorRunById.get(asText(sourceEvent.connector_run_id));
    const authenticity =
      proofAuthenticityForOpportunity({
        opportunity,
        sourceEvent,
        connectorRunMetadata: asRecord(connectorRun?.metadata),
        sourceById: input.sourceById
      }) || "unknown";
    opportunityAuthenticity.set(asText(opportunity.id), authenticity);

    const qualification = getOpportunityQualificationSnapshot({
      explainability: asRecord(opportunity.explainability_json),
      lifecycleStatus: opportunity.lifecycle_status,
      contactStatus: opportunity.contact_status,
      proofAuthenticity: authenticity
    });

    if (qualification.researchOnly) researchOnlyCount += 1;
    if (qualification.requiresSdrQualification || qualification.qualificationStatus === "queued_for_sdr" || qualification.qualificationStatus === "research_only") {
      opportunitiesRequiringSdr += 1;
    }
    if (qualification.qualificationStatus === "qualified_contactable") {
      qualifiedContactableOpportunities += 1;
    }

    const countsAsRealCapture =
      (authenticity === "live_provider" || authenticity === "live_derived") &&
      !qualification.researchOnly;
    if (countsAsRealCapture) {
      realOpportunitiesCaptured += 1;
      realCaptureOpportunityCount += 1;
    }
  }

  for (const lead of input.leads) {
    const opportunityId = asText(lead.opportunity_id);
    const opportunity = input.opportunities.find((row) => asText(row.id) === opportunityId) || {};
    const qualification = getOpportunityQualificationSnapshot({
      explainability: asRecord(opportunity.explainability_json),
      lifecycleStatus: opportunity.lifecycle_status,
      contactStatus: opportunity.contact_status,
      proofAuthenticity: opportunityAuthenticity.get(opportunityId) || "unknown"
    });
    const leadSnapshot = leadVerificationSnapshot(lead);
    const countsAsRealLead =
      (opportunityAuthenticity.get(opportunityId) === "live_provider" || opportunityAuthenticity.get(opportunityId) === "live_derived") &&
      qualification.qualificationStatus === "qualified_contactable" &&
      leadSnapshot.verified;

    if (countsAsRealLead) {
      realLeadsCreated += 1;
      countsAsRealLeadCount += 1;
      const bookedJobs = (jobsByLead.get(asText(lead.id)) || []).filter((job) => String(job.status || "").toLowerCase().includes("book"));
      bookedJobsAttributed += bookedJobs.length;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    tenantId: input.franchiseTenantId,
    isDemo: false,
    sourceEventsCaptured,
    realSourceEventsCaptured,
    opportunitiesCreated: input.opportunities.length,
    opportunitiesUpdated,
    realOpportunitiesCaptured,
    opportunitiesRequiringSdr,
    qualifiedContactableOpportunities,
    leadsCreated: input.leads.length,
    realLeadsCreated,
    bookedJobsAttributed,
    counts: {
      is_simulated: simulatedCount,
      is_research_only: researchOnlyCount,
      counts_as_real_capture: realCaptureOpportunityCount,
      counts_as_real_lead: countsAsRealLeadCount
    }
  } satisfies CaptureProofSummary;
}

function sourceRankingScore(stats: {
  event_count: number;
  approved_event_count: number;
  freshness_scores: number[];
  reliability_scores: number[];
  verified_lead_count: number;
  opportunity_count: number;
  lead_count: number;
  booked_job_count: number;
}) {
  const approvedRate = stats.event_count > 0 ? stats.approved_event_count / stats.event_count : 0;
  const freshness = stats.freshness_scores.length ? stats.freshness_scores.reduce((sum, value) => sum + value, 0) / stats.freshness_scores.length : 0;
  const reliability = stats.reliability_scores.length ? stats.reliability_scores.reduce((sum, value) => sum + value, 0) / stats.reliability_scores.length : 0;
  const verifiedLeadRate = stats.opportunity_count > 0 ? stats.verified_lead_count / stats.opportunity_count : 0;
  const bookedJobRate = stats.lead_count > 0 ? stats.booked_job_count / stats.lead_count : 0;
  const falsePositiveRate = stats.opportunity_count > 0 ? Math.max(0, (stats.opportunity_count - stats.verified_lead_count) / stats.opportunity_count) : 1;

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        approvedRate * 20 +
          freshness * 0.2 +
          reliability * 0.25 +
          verifiedLeadRate * 30 +
          bookedJobRate * 25 -
          falsePositiveRate * 18
      )
    )
  );

  return {
    approvedRate,
    freshness,
    reliability,
    verifiedLeadRate,
    bookedJobRate,
    falsePositiveRate,
    score,
    recommendation: score >= 75 ? "keep" : score >= 50 ? "tune" : "pause"
  };
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
  const scheduledWork = jobRows.filter((row) => {
    const status = String(row.status || "").toLowerCase();
    return status.includes("schedule") || status.includes("book");
  }).length;
  const totalRevenue = jobRows
    .filter((row) => String(row.status || "").toLowerCase().includes("book"))
    .reduce((sum, row) => sum + toNumber(row.revenue_amount), 0);

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
    { label: "scheduled_work", value: scheduledWork },
    { label: "assignment_acceptances", value: acceptedAssignments },
    { label: "assignment_overdue", value: overdueAssignments },
    { label: "catastrophe_surge_signals", value: catastrophe },
    { label: "multi_signal_opportunities", value: multiSignalCount },
    { label: "cluster_linked_opportunities", value: clusterLinkedCount },
    { label: "distress_signal_opportunities", value: distressCount },
    { label: "connector_runs_completed", value: completedConnectorRuns },
    { label: "connector_runs_failed", value: failedConnectorRuns },
    { label: "estimated_revenue", value: totalRevenue },
    { label: "attributable_revenue", value: totalRevenue }
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
    { data: leads },
    { data: outreachEvents },
    { data: territories },
    { data: dataSources },
    { data: connectorRuns },
    { data: sourceEvents }
  ] = await Promise.all([
    supabase
      .from("v2_opportunities")
      .select(
        "id,title,opportunity_type,service_line,postal_code,source_event_id,urgency_score,job_likelihood_score,source_reliability_score,catastrophe_linkage_score,incident_cluster_id,explainability_json,routing_status,lifecycle_status,created_at"
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
      .from("v2_leads")
      .select("id,opportunity_id,lead_status,contact_name,contact_channels_json,created_at,owner_user_id")
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
      .limit(300),
    supabase
      .from("v2_source_events")
      .select(
        "id,source_id,connector_run_id,compliance_status,source_reliability_score,normalized_payload,event_type,occurred_at,ingested_at"
      )
      .eq("tenant_id", franchiseTenantId)
      .order("ingested_at", { ascending: false })
      .limit(500)
  ]);

  const oppRows = (opportunities || []) as Array<Record<string, unknown>>;
  const assignmentRows = (assignments || []) as Array<Record<string, unknown>>;
  const jobRows = (jobs || []) as Array<Record<string, unknown>>;
  const leadRows = (leads || []) as Array<Record<string, unknown>>;
  const outreachRows = (outreachEvents || []) as Array<Record<string, unknown>>;
  const territoryRows = (territories || []) as Array<Record<string, unknown>>;
  const sourceRows = (dataSources || []) as Array<Record<string, unknown>>;
  const connectorRows = (connectorRuns || []) as Array<Record<string, unknown>>;
  const sourceEventRows = (sourceEvents || []) as Array<Record<string, unknown>>;
  const connectorRunById = new Map(connectorRows.map((row) => [asText(row.id), row]));
  const sourceById = new Map(sourceRows.map((row) => [asText(row.id), row]));

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
  const verifiedLeadRows = leadRows.filter((row) => leadVerificationSnapshot(row).verified);
  const reviewLeadRows = leadRows.filter((row) => leadVerificationSnapshot(row).review);
  const rejectedLeadRows = leadRows.filter((row) => leadVerificationSnapshot(row).rejected);
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

  const opportunitiesBySourceEvent = new Map<string, Record<string, unknown>[]>();
  for (const opportunity of oppRows) {
    const sourceEventId = asText(opportunity.source_event_id);
    if (!sourceEventId) continue;
    const bucket = opportunitiesBySourceEvent.get(sourceEventId) || [];
    bucket.push(opportunity);
    opportunitiesBySourceEvent.set(sourceEventId, bucket);
  }

  const leadsByOpportunity = new Map<string, Record<string, unknown>[]>();
  for (const lead of leadRows) {
    const opportunityId = asText(lead.opportunity_id);
    if (!opportunityId) continue;
    const bucket = leadsByOpportunity.get(opportunityId) || [];
    bucket.push(lead);
    leadsByOpportunity.set(opportunityId, bucket);
  }

  const jobsByLead = new Map<string, Record<string, unknown>[]>();
  for (const job of jobRows) {
    const leadId = asText(job.lead_id);
    if (!leadId) continue;
    const bucket = jobsByLead.get(leadId) || [];
    bucket.push(job);
    jobsByLead.set(leadId, bucket);
  }

  const outreachByLead = new Map<string, Record<string, unknown>[]>();
  for (const outreach of outreachRows) {
    const leadId = asText(outreach.lead_id);
    if (!leadId) continue;
    const bucket = outreachByLead.get(leadId) || [];
    bucket.push(outreach);
    outreachByLead.set(leadId, bucket);
  }

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

  const sourceStats = new Map<
    string,
    {
      key: string;
      source_id: string;
      source_type: string;
      source_name: string;
      source_provenance: string;
      source_category: string;
      authenticity: ProofAuthenticity;
      compliance_statuses: Set<string>;
      approved_event_count: number;
      freshness_scores: number[];
      reliability_scores: number[];
      event_count: number;
      opportunity_count: number;
      lead_count: number;
      verified_lead_count: number;
      review_lead_count: number;
      rejected_lead_count: number;
      booked_job_count: number;
      revenue: number;
      outreach_count: number;
      live_provider_event_count: number;
      synthetic_event_count: number;
    }
  >();

  for (const sourceEvent of sourceEventRows) {
    const key =
      [sourceEvent.source_id, sourceNameForEvent(sourceEvent, sourceById), sourceTypeForEvent(sourceEvent, sourceById), sourceProvenanceForEvent(sourceEvent, sourceById)]
        .map((value) => asText(value))
        .filter(Boolean)
        .join(" | ") || "unknown-source";

    if (!sourceStats.has(key)) {
      sourceStats.set(key, {
        key,
        source_id: asText(sourceEvent.source_id),
        source_type: sourceTypeForEvent(sourceEvent, sourceById),
        source_name: sourceNameForEvent(sourceEvent, sourceById),
        source_provenance: sourceProvenanceForEvent(sourceEvent, sourceById),
        source_category: sourceCategoryFromSignal(sourceTypeForEvent(sourceEvent, sourceById)),
        authenticity: "unknown",
        compliance_statuses: new Set<string>(),
        approved_event_count: 0,
        freshness_scores: [],
        reliability_scores: [],
        event_count: 0,
        opportunity_count: 0,
        lead_count: 0,
        verified_lead_count: 0,
        review_lead_count: 0,
        rejected_lead_count: 0,
        booked_job_count: 0,
        revenue: 0,
        outreach_count: 0,
        live_provider_event_count: 0,
        synthetic_event_count: 0
      });
    }

    const stats = sourceStats.get(key)!;
    const authenticity = classifyProofAuthenticity({
      sourceType: sourceTypeForEvent(sourceEvent, sourceById),
      sourceName: sourceNameForEvent(sourceEvent, sourceById),
      sourceProvenance: sourceProvenanceForEvent(sourceEvent, sourceById),
      normalizedPayload: asRecord(sourceEvent.normalized_payload),
      connectorRunMetadata: asRecord(connectorRunById.get(asText(sourceEvent.connector_run_id))?.metadata)
    });
    stats.authenticity = authenticity === "live_provider" ? "live_provider" : stats.authenticity;
    stats.event_count += 1;
    if (authenticity === "live_provider") stats.live_provider_event_count += 1;
    if (authenticity === "synthetic") stats.synthetic_event_count += 1;
    const compliance = asText(sourceEvent.compliance_status || "unknown");
    stats.compliance_statuses.add(compliance);
    if (compliance === "approved") stats.approved_event_count += 1;
    stats.freshness_scores.push(sourceFreshnessForEvent(sourceEvent));
    stats.reliability_scores.push(toNumber(sourceEvent.source_reliability_score, 0));

    const opportunitiesForSource = opportunitiesBySourceEvent.get(asText(sourceEvent.id)) || [];
    const eligibleOpportunitiesForSource = opportunitiesForSource.filter((opportunity) =>
      isBuyerProofEligibleOpportunity({
        opportunity,
        sourceEvent,
        connectorRunMetadata: asRecord(connectorRunById.get(asText(sourceEvent.connector_run_id))?.metadata),
        sourceById
      })
    );
    stats.opportunity_count += eligibleOpportunitiesForSource.length;

    for (const opportunity of eligibleOpportunitiesForSource) {
      const leadsForOpportunity = leadsByOpportunity.get(asText(opportunity.id)) || [];
      stats.lead_count += leadsForOpportunity.length;

      for (const lead of leadsForOpportunity) {
        const leadSnapshot = leadVerificationSnapshot(lead);
        if (leadSnapshot.verified) stats.verified_lead_count += 1;
        else if (leadSnapshot.review) stats.review_lead_count += 1;
        else stats.rejected_lead_count += 1;

        const leadJobs = jobsByLead.get(asText(lead.id)) || [];
        const bookedJobsForLead = leadJobs.filter((job) => String(job.status || "").toLowerCase().includes("book"));
        stats.booked_job_count += bookedJobsForLead.length;
        stats.revenue += bookedJobsForLead.reduce((sum, job) => sum + toNumber(job.revenue_amount, 0), 0);

        const leadOutreach = outreachByLead.get(asText(lead.id)) || [];
        stats.outreach_count += leadOutreach.length;
      }
    }
  }

  const sourceQualityPreview = Array.from(sourceStats.values())
    .filter((stats) => stats.authenticity !== "synthetic")
    .map((stats) => {
      const ranking = sourceRankingScore(stats);
      return {
        source_id: stats.source_id,
        source_name: stats.source_name,
        source_type: stats.source_type,
        source_category: stats.source_category,
        source_provenance: stats.source_provenance,
        authenticity: stats.authenticity,
        event_count: stats.event_count,
        opportunity_count: stats.opportunity_count,
        lead_count: stats.lead_count,
        verified_lead_count: stats.verified_lead_count,
        review_lead_count: stats.review_lead_count,
        rejected_lead_count: stats.rejected_lead_count,
        booked_job_count: stats.booked_job_count,
        live_provider_event_count: stats.live_provider_event_count,
        synthetic_event_count: stats.synthetic_event_count,
        avg_freshness_score: Math.round(ranking.freshness),
        avg_reliability_score: Math.round(ranking.reliability),
        false_positive_rate: ranking.falsePositiveRate,
        score: ranking.score,
        recommendation: ranking.recommendation
      };
    })
    .sort((a, b) => b.score - a.score);

  const sourceTrustSummary = sourceQualityPreview.reduce(
    (acc, row) => {
      const recommendation = String(row.recommendation || "pause");
      if (recommendation === "keep") acc.keep += 1;
      else if (recommendation === "tune") acc.tune += 1;
      else acc.pause += 1;
      return acc;
    },
    { keep: 0, tune: 0, pause: 0 }
  );

  const buyerProofVerifiedLeadRows = verifiedLeadRows.filter((lead) => {
    const opportunity = oppRows.find((row) => asText(row.id) === asText(lead.opportunity_id)) || {};
    const sourceEvent = sourceEventRows.find((row) => asText(row.id) === asText(opportunity.source_event_id)) || {};
    const connectorRun = connectorRunById.get(asText(sourceEvent.connector_run_id));
    return isBuyerProofEligibleOpportunity({
      opportunity,
      sourceEvent,
      connectorRunMetadata: asRecord(connectorRun?.metadata),
      sourceById
    });
  });
  const buyerProofLeadRows = leadRows.filter((lead) => {
    const opportunity = oppRows.find((row) => asText(row.id) === asText(lead.opportunity_id)) || {};
    const sourceEvent = sourceEventRows.find((row) => asText(row.id) === asText(opportunity.source_event_id)) || {};
    const connectorRun = connectorRunById.get(asText(sourceEvent.connector_run_id));
    return isBuyerProofEligibleOpportunity({
      opportunity,
      sourceEvent,
      connectorRunMetadata: asRecord(connectorRun?.metadata),
      sourceById
    });
  });

  const proofSamples = buyerProofVerifiedLeadRows
    .map((lead) => {
      const snapshot = leadVerificationSnapshot(lead);
      const opportunity = oppRows.find((row) => asText(row.id) === asText(lead.opportunity_id)) || {};
      const sourceEvent = sourceEventRows.find((row) => asText(row.id) === asText(opportunity.source_event_id)) || {};
      const connectorRun = connectorRunById.get(asText(sourceEvent.connector_run_id));
      const authenticity = proofAuthenticityForOpportunity({
        opportunity,
        sourceEvent,
        connectorRunMetadata: asRecord(connectorRun?.metadata),
        sourceById
      });
      const leadJobs = jobsByLead.get(asText(lead.id)) || [];
      const leadOutreach = outreachByLead.get(asText(lead.id)) || [];
      const contact = [snapshot.phone, snapshot.email].filter(Boolean).join(" / ") || "n/a";

      return {
        lead_id: asText(lead.id),
        contact_name: asText(lead.contact_name || "Unknown"),
        contact,
        source_name: sourceNameForEvent(sourceEvent, sourceById),
        source_type: sourceTypeForEvent(sourceEvent, sourceById) || "unknown",
        source_provenance: sourceProvenanceForEvent(sourceEvent, sourceById),
        proof_authenticity: authenticity,
        opportunity_title: asText(opportunity.title || ""),
        service_line: asText(opportunity.service_line || "general"),
        verification_score: snapshot.verificationScore,
        verification_reasons: snapshot.reasons,
        booked_jobs: leadJobs.filter((job) => String(job.status || "").toLowerCase().includes("book")).length,
        outreach_events: leadOutreach.length,
        proof_summary: [
          snapshot.phone ? `phone ${snapshot.phone}` : "",
          snapshot.email ? `email ${snapshot.email}` : "",
          asText(sourceNameForEvent(sourceEvent, sourceById) || sourceTypeForEvent(sourceEvent, sourceById) || "")
            ? `source ${asText(sourceNameForEvent(sourceEvent, sourceById) || sourceTypeForEvent(sourceEvent, sourceById) || "")}`
            : "",
          authenticity !== "unknown" ? `proof ${authenticity.replace(/_/g, " ")}` : "",
          asText(opportunity.service_line || "") ? `service line ${asText(opportunity.service_line || "")}` : "",
          snapshot.reasons.slice(0, 3).join(", ")
        ]
          .filter(Boolean)
          .join("; ")
      };
    })
    .sort((a, b) => b.verification_score - a.verification_score || b.booked_jobs - a.booked_jobs)
    .slice(0, 5);

  const bookedJobsFromVerifiedLeads = buyerProofVerifiedLeadRows.reduce((sum, lead) => {
    const leadJobs = jobsByLead.get(asText(lead.id)) || [];
    return sum + leadJobs.filter((job) => String(job.status || "").toLowerCase().includes("book")).length;
  }, 0);

  const networkLeadRows = leadRows.filter((row) => {
    if (!isNetworkActivatedLead(row)) return false;
    const opportunity = oppRows.find((opp) => asText(opp.id) === asText(row.opportunity_id)) || {};
    const sourceEvent = sourceEventRows.find((event) => asText(event.id) === asText(opportunity.source_event_id)) || {};
    const connectorRun = connectorRunById.get(asText(sourceEvent.connector_run_id));
    return isBuyerProofEligibleOpportunity({
      opportunity,
      sourceEvent,
      connectorRunMetadata: asRecord(connectorRun?.metadata)
    });
  });
  const verifiedNetworkLeadRows = networkLeadRows.filter((row) => leadVerificationSnapshot(row).verified);
  const networkLeadIds = new Set(networkLeadRows.map((row) => asText(row.id)));
  const networkOpportunityIds = new Set(networkLeadRows.map((row) => asText(row.opportunity_id)).filter(Boolean));
  const networkOutreachEvents = outreachRows.filter((row) => networkLeadIds.has(asText(row.lead_id)));
  const bookedJobsFromNetworkLeads = networkLeadRows.reduce((sum, lead) => {
    const leadJobs = jobsByLead.get(asText(lead.id)) || [];
    return sum + leadJobs.filter((job) => String(job.status || "").toLowerCase().includes("book")).length;
  }, 0);

  const liveProviderVerifiedLeadRows = buyerProofVerifiedLeadRows.filter((lead) => {
    const opportunity = oppRows.find((row) => asText(row.id) === asText(lead.opportunity_id)) || {};
    const sourceEvent = sourceEventRows.find((row) => asText(row.id) === asText(opportunity.source_event_id)) || {};
    const connectorRun = connectorRunById.get(asText(sourceEvent.connector_run_id));
    return proofAuthenticityForOpportunity({
      opportunity,
      sourceEvent,
      connectorRunMetadata: asRecord(connectorRun?.metadata)
    }) === "live_provider";
  });

  const liveProviderBookedJobs = liveProviderVerifiedLeadRows.reduce((sum, lead) => {
    const leadJobs = jobsByLead.get(asText(lead.id)) || [];
    return sum + leadJobs.filter((job) => String(job.status || "").toLowerCase().includes("book")).length;
  }, 0);

  const bookedJobsFromReviewLeads = reviewLeadRows.reduce((sum, lead) => {
    const leadJobs = jobsByLead.get(asText(lead.id)) || [];
    return sum + leadJobs.filter((job) => String(job.status || "").toLowerCase().includes("book")).length;
  }, 0);
  const captureProofSummary = buildCaptureProofSummary({
    franchiseTenantId,
    sourceEvents: sourceEventRows,
    opportunities: oppRows,
    leads: leadRows,
    jobs: jobRows,
    connectorRunById
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
    intelligence: {
      source_mix_by_category: sourceMixByCategory,
      opportunities_by_service_line: opportunitiesByServiceLine,
      multi_signal_opportunities: multiSignalCount,
      cluster_linked_opportunities: clusterLinkedCount,
      distress_signal_opportunities: distressCount,
      source_quality_preview: sourceQualityPreview.slice(0, 5),
      source_trust_summary: sourceTrustSummary
    },
    lead_quality_proof: {
      verified_lead_count: buyerProofVerifiedLeadRows.length,
      live_provider_verified_lead_count: liveProviderVerifiedLeadRows.length,
      network_verified_lead_count: verifiedNetworkLeadRows.length,
      review_lead_count: reviewLeadRows.length,
      rejected_lead_count: rejectedLeadRows.length,
      contactable_lead_count: buyerProofLeadRows.filter((row) => leadVerificationSnapshot(row).contactable).length,
      booked_jobs_from_verified_leads: bookedJobsFromVerifiedLeads,
      booked_jobs_from_live_provider_verified_leads: liveProviderBookedJobs,
      booked_jobs_from_network_leads: bookedJobsFromNetworkLeads,
      network_activated_opportunity_count: networkOpportunityIds.size,
      network_outreach_event_count: networkOutreachEvents.length,
      booked_jobs_from_review_leads: bookedJobsFromReviewLeads,
      source_quality_preview: sourceQualityPreview.slice(0, 5),
      proof_samples: proofSamples
    },
    capture_proof_summary: captureProofSummary,
    freshness: {
      generated_at: new Date().toISOString(),
      outreach_events_considered: outreachRows.length,
      connector_runs_considered: connectorRows.length
    }
  };
}
