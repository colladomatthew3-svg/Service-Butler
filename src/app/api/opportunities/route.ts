import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { isDemoMode } from "@/lib/services/review-mode";
import { getV2TenantContext } from "@/lib/v2/context";
import { getOpportunityQualificationSnapshot, qualificationAllowsDispatch } from "@/lib/v2/opportunity-qualification";
import { deriveOpportunityPipelineStage } from "@/lib/v2/opportunity-pipeline";
import { classifyProofAuthenticity } from "@/lib/v2/proof-authenticity";
import { classifySourceLane, opportunityPriorityScore } from "@/lib/v2/source-lanes";
import { deriveOpportunityActionability } from "@/lib/v2/opportunity-actionability";
import { qualifiesAsRealSourceCapture, isIntegrationValidationRecord } from "@/lib/v2/source-truth";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function leadCountsAsReal(row: Record<string, unknown>) {
  const channels = asRecord(row.contact_channels_json);
  const verificationStatus = asText(channels.verification_status || row.lead_status).toLowerCase();
  const verificationScore = toNumber(channels.verification_score || 0);
  const phone = asText(channels.phone);
  const email = asText(channels.email);
  return verificationStatus === "verified" && verificationScore >= 70 && Boolean(phone || email);
}

function deriveOpportunityFreshnessTimestamp(row: Record<string, unknown>, explainability: Record<string, unknown>) {
  return (
    asText(explainability.freshness_timestamp) ||
    asText(explainability.occurred_at) ||
    asText(explainability.event_timestamp) ||
    asText(explainability.source_published_at) ||
    asText(row.created_at) ||
    null
  );
}

function deriveOpportunitySourceLabel(row: Record<string, unknown>, explainability: Record<string, unknown>) {
  const sourceTypes = Array.isArray(explainability.source_types) ? explainability.source_types.map((value) => asText(value)).filter(Boolean) : [];
  return sourceTypes[0] || asText(explainability.source_type) || asText(explainability.source_name) || asText(row.service_line || row.opportunity_type) || null;
}

function deriveOpportunityContactableNow(qualification: ReturnType<typeof getOpportunityQualificationSnapshot>) {
  return qualificationAllowsDispatch(qualification);
}

function deriveOpportunityOutreachAllowed({
  qualification,
  actionability,
  countsAsRealCapture
}: {
  qualification: ReturnType<typeof getOpportunityQualificationSnapshot>;
  actionability: ReturnType<typeof deriveOpportunityActionability>;
  countsAsRealCapture: boolean;
}) {
  return countsAsRealCapture && qualificationAllowsDispatch(qualification) && !actionability.reviewRequired;
}

function legacyOpportunitySource(raw: Record<string, unknown>, row: Record<string, unknown>) {
  return asText(raw.source_type) || asText(raw.source_name) || asText(row.category) || "legacy_opportunity";
}

function legacyOpportunityFreshness(raw: Record<string, unknown>, row: Record<string, unknown>) {
  return asText(raw.freshness_timestamp) || asText(raw.occurred_at) || asText(raw.source_published_at) || asText(row.created_at) || null;
}

export async function GET(req: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json({
      opportunities: [],
      warning: "Operator opportunities only show persisted real signals. Demo opportunity data is disabled on this surface."
    });
  }

  if (featureFlags.useV2Reads) {
    const v2Context = await getV2TenantContext().catch(() => null);
    if (v2Context) {
      const category = (req.nextUrl.searchParams.get("category") || "").trim().toLowerCase();
      const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
      const limit = Math.max(1, Math.min(250, Number.isFinite(limitRaw) ? limitRaw : 50));

      let query = v2Context.supabase
        .from("v2_opportunities")
        .select(
          "id,source_event_id,opportunity_type,service_line,title,description,location_text,postal_code,urgency_score,job_likelihood_score,contactability_score,source_reliability_score,revenue_band,catastrophe_linkage_score,routing_status,lifecycle_status,contact_status,explainability_json,created_at"
        )
        .eq("tenant_id", v2Context.franchiseTenantId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (category && category !== "all") query = query.eq("service_line", category);

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const opportunityIds = (data || []).map((row) => String(row.id));
      const sourceEventIds = Array.from(new Set((data || []).map((row) => String(row.source_event_id || "")).filter(Boolean)));
      const verifiedLeadOpportunityIds = new Set<string>();
      const latestAssignmentByOpportunity = new Map<string, Record<string, unknown>>();
      const sourceEventById = new Map<string, Record<string, unknown>>();
      const sourceById = new Map<string, Record<string, unknown>>();
      const connectorRunById = new Map<string, Record<string, unknown>>();

      if (opportunityIds.length > 0) {
        const { data: leadRows, error: leadError } = await v2Context.supabase
          .from("v2_leads")
          .select("opportunity_id,lead_status,contact_channels_json")
          .eq("tenant_id", v2Context.franchiseTenantId)
          .in("opportunity_id", opportunityIds);

        if (leadError) return NextResponse.json({ error: leadError.message }, { status: 400 });

        for (const lead of leadRows || []) {
          if (leadCountsAsReal(lead as Record<string, unknown>)) {
            verifiedLeadOpportunityIds.add(String((lead as Record<string, unknown>).opportunity_id || ""));
          }
        }

        const { data: assignments, error: assignmentError } = await v2Context.supabase
          .from("v2_assignments")
          .select("id,opportunity_id,status,assigned_tenant_id,sla_due_at,assignment_reason,created_at")
          .eq("tenant_id", v2Context.franchiseTenantId)
          .in("opportunity_id", opportunityIds)
          .order("created_at", { ascending: false });

        if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 400 });

        for (const assignment of (assignments || []) as Array<Record<string, unknown>>) {
          const opportunityId = String(assignment.opportunity_id || "");
          if (!opportunityId || latestAssignmentByOpportunity.has(opportunityId)) continue;
          latestAssignmentByOpportunity.set(opportunityId, assignment);
        }

        if (sourceEventIds.length > 0) {
          const { data: sourceEvents, error: sourceEventError } = await v2Context.supabase
            .from("v2_source_events")
            .select("id,source_id,connector_run_id,compliance_status,normalized_payload")
            .eq("tenant_id", v2Context.franchiseTenantId)
            .in("id", sourceEventIds);

          if (sourceEventError) return NextResponse.json({ error: sourceEventError.message }, { status: 400 });

          const relatedSourceIds = Array.from(new Set((sourceEvents || []).map((row) => String((row as Record<string, unknown>).source_id || "")).filter(Boolean)));
          const relatedConnectorRunIds = Array.from(
            new Set((sourceEvents || []).map((row) => String((row as Record<string, unknown>).connector_run_id || "")).filter(Boolean))
          );

          for (const sourceEvent of (sourceEvents || []) as Array<Record<string, unknown>>) {
            sourceEventById.set(String(sourceEvent.id || ""), sourceEvent);
          }

          if (relatedSourceIds.length > 0) {
            const { data: sources, error: sourceError } = await v2Context.supabase
              .from("v2_data_sources")
              .select("id,status,terms_status,compliance_status,rollout_state,readiness_status,health_status,freshness_timestamp,freshness_sla_minutes")
              .eq("tenant_id", v2Context.franchiseTenantId)
              .in("id", relatedSourceIds);

            if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 400 });
            for (const source of (sources || []) as Array<Record<string, unknown>>) {
              sourceById.set(String(source.id || ""), source);
            }
          }

          if (relatedConnectorRunIds.length > 0) {
            const { data: connectorRuns, error: connectorError } = await v2Context.supabase
              .from("v2_connector_runs")
              .select("id,status,metadata")
              .eq("tenant_id", v2Context.franchiseTenantId)
              .in("id", relatedConnectorRunIds);

            if (connectorError) return NextResponse.json({ error: connectorError.message }, { status: 400 });
            for (const connectorRun of (connectorRuns || []) as Array<Record<string, unknown>>) {
              connectorRunById.set(String(connectorRun.id || ""), connectorRun);
            }
          }
        }
      }

      return NextResponse.json({
        opportunities: (data || [])
          .filter((row: Record<string, unknown>) => !isIntegrationValidationRecord(asRecord(row.explainability_json)))
          .map((row: Record<string, unknown>) => {
          const explainability = (row.explainability_json as Record<string, unknown> | null) || {};
          const sourceEvent = sourceEventById.get(String(row.source_event_id || "")) || null;
          const source = sourceEvent ? sourceById.get(String(sourceEvent.source_id || "")) || null : null;
          const connectorRun = sourceEvent ? connectorRunById.get(String(sourceEvent.connector_run_id || "")) || null : null;
          const proofAuthenticity = classifyProofAuthenticity({
            sourceType:
              Array.isArray(explainability.source_types) && explainability.source_types.length > 0
                ? explainability.source_types[0]
                : row.service_line || row.opportunity_type,
            sourceProvenance: explainability.source_provenance
          });
          const qualification = getOpportunityQualificationSnapshot({
            explainability,
            proofAuthenticity
          });
          const sourceLane = classifySourceLane({
            sourceTypes: Array.isArray(explainability.source_types) ? (explainability.source_types as unknown[]) : [],
            sourceProvenance: explainability.source_provenance,
            sourceType:
              Array.isArray(explainability.source_types) && explainability.source_types.length > 0
                ? explainability.source_types[0]
                : row.service_line || row.opportunity_type,
            category: row.opportunity_type,
            serviceLine: row.service_line,
            summary: explainability.distress_context_summary,
            reasoning: explainability.confidence_reasoning
          });
          const priorityScore = opportunityPriorityScore({
            urgencyScore: row.urgency_score,
            jobLikelihoodScore: row.job_likelihood_score,
            sourceReliabilityScore: row.source_reliability_score
          });
          const assignment = latestAssignmentByOpportunity.get(String(row.id || "")) || null;
          const actionability = deriveOpportunityActionability({
            lifecycleStatus: row.lifecycle_status,
            routingStatus: row.routing_status,
            contactStatus: row.contact_status,
            explainability,
            assignment
          });
          const dispatchReady = qualificationAllowsDispatch(qualification);
          const countsAsRealCapture = qualifiesAsRealSourceCapture({
            authenticity: proofAuthenticity,
            explainability,
            source,
            sourceEvent,
            connectorRun
          });
          const freshnessTimestamp = deriveOpportunityFreshnessTimestamp(row, explainability);
          const sourceLabel = deriveOpportunitySourceLabel(row, explainability);
          const contactableNow = deriveOpportunityContactableNow(qualification);
          const outreachAllowed = deriveOpportunityOutreachAllowed({
            qualification,
            actionability,
            countsAsRealCapture
          });
          const pipelineStage = deriveOpportunityPipelineStage({
            lifecycleStatus: row.lifecycle_status,
            routingStatus: row.routing_status,
            contactStatus: row.contact_status,
            sourceEventId: row.source_event_id,
            opportunityType: row.opportunity_type,
            serviceLine: row.service_line,
            urgencyScore: row.urgency_score,
            jobLikelihoodScore: row.job_likelihood_score,
            sourceReliabilityScore: row.source_reliability_score,
            explainability
          });

          return {
            id: row.id,
            category: row.service_line || row.opportunity_type,
            service_line: row.service_line,
            title: row.title,
            description: row.description,
            location_text: row.location_text,
            city: null,
            state: null,
            zip: row.postal_code,
            territory: null,
            lat: null,
            lon: null,
            intent_score: row.job_likelihood_score,
            confidence: row.source_reliability_score,
            urgency_score: row.urgency_score,
            signal_count: typeof explainability.signal_count === "number" ? explainability.signal_count : null,
            source_types: Array.isArray(explainability.source_types) ? (explainability.source_types as unknown[]) : [],
            confidence_reasoning: typeof explainability.confidence_reasoning === "string" ? explainability.confidence_reasoning : null,
            estimated_response_window:
              typeof explainability.estimated_response_window === "string" ? explainability.estimated_response_window : null,
            distress_context_summary:
              typeof explainability.distress_context_summary === "string" ? explainability.distress_context_summary : null,
            tags: [],
            suggested_action: null,
            recommended_action: null,
            status: row.lifecycle_status,
            pipeline_stage: pipelineStage,
            qualification_status: qualification.qualificationStatus,
            qualification_reason_code: qualification.qualificationReasonCode,
            proof_authenticity: qualification.proofAuthenticity,
            source: sourceLabel,
            source_lane: sourceLane,
            source_provenance: typeof explainability.source_provenance === "string" ? explainability.source_provenance : null,
            freshness_timestamp: freshnessTimestamp,
            territory_fit: actionability.territoryRelevance,
            priority_score: priorityScore,
            next_recommended_action: qualification.nextRecommendedAction,
            recommended_next_action: actionability.recommendedNextAction,
            recommended_action_reason: actionability.recommendedActionReason,
            recommended_action_sla_minutes: actionability.recommendedActionSlaMinutes,
            freshness_score: actionability.freshnessScore,
            confidence_score: actionability.confidenceScore,
            territory_relevance: actionability.territoryRelevance,
            review_required: actionability.reviewRequired,
            assignment_id: actionability.assignmentId,
            assignment_status: actionability.assignmentStatus,
            assigned_tenant_id: actionability.assignedTenantId,
            assignment_sla_due_at: actionability.assignmentSlaDueAt,
            assignment_reason: actionability.assignmentReason,
            can_route_now: actionability.canRouteNow,
            can_accept_assignment: actionability.canAcceptAssignment,
            can_escalate_assignment: actionability.canEscalateAssignment,
            can_convert_to_job: actionability.canConvertToJob,
            contactable_now: contactableNow,
            outreach_allowed: outreachAllowed,
            research_only: qualification.researchOnly,
            requires_sdr_qualification: qualification.requiresSdrQualification,
            verification_status: qualification.verificationStatus,
            dispatch_ready: dispatchReady || actionability.dispatchReady,
            counts_as_real_capture: countsAsRealCapture,
            counts_as_real_lead: countsAsRealCapture && verifiedLeadOpportunityIds.has(String(row.id)),
            raw: {
              revenue_band: row.revenue_band,
              routing_status: row.routing_status,
              contact_status: row.contact_status,
              catastrophe_linkage_score: row.catastrophe_linkage_score,
              contactability_score: row.contactability_score,
              explainability: row.explainability_json,
              network_activation: explainability.network_activation || null
            },
            created_at: row.created_at
          };
        })
      });
    }
  }

  const { accountId, supabase } = await getCurrentUserContext();
  const category = (req.nextUrl.searchParams.get("category") || "").trim().toLowerCase();
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
  const limit = Math.max(1, Math.min(250, Number.isFinite(limitRaw) ? limitRaw : 50));

  let query = supabase
    .from("opportunities")
    .select("id,category,title,description,location_text,city,state,zip,territory,lat,lon,intent_score,confidence,urgency_score,tags,suggested_action,recommended_action,status,raw,created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category && category !== "all") query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    opportunities: (data || [])
      .filter((row: Record<string, unknown>) => !isIntegrationValidationRecord(asRecord(row.raw)))
      .map((row: Record<string, unknown>) => {
      const raw = asRecord(row.raw);
      const proofAuthenticity = asText(raw.proof_authenticity).toLowerCase();
      const contactableNow = Boolean(asText(raw.phone) || asText(raw.email));
      const countsAsRealCapture = proofAuthenticity === "live_provider" || proofAuthenticity === "live_derived";
      return {
        ...row,
        source: legacyOpportunitySource(raw, row),
        freshness_timestamp: legacyOpportunityFreshness(raw, row),
        territory_fit: asText(raw.territory_relevance) || asText(row.territory) || null,
        contactable_now: contactableNow,
        outreach_allowed: countsAsRealCapture && contactableNow && !Boolean(raw.review_required),
        review_required: Boolean(raw.review_required),
        proof_authenticity: proofAuthenticity || "unknown",
        service_line: asText(raw.service_line) || asText(row.category) || null,
        counts_as_real_capture: countsAsRealCapture,
        counts_as_real_lead: countsAsRealCapture && contactableNow
      };
    })
  });
}
