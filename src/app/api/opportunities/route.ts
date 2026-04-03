import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { getDemoDashboardSnapshot } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/services/review-mode";
import { getV2TenantContext } from "@/lib/v2/context";
import { getOpportunityQualificationSnapshot } from "@/lib/v2/opportunity-qualification";
import { classifyProofAuthenticity } from "@/lib/v2/proof-authenticity";
import { classifySourceLane, opportunityPriorityScore } from "@/lib/v2/source-lanes";

export async function GET(req: NextRequest) {
  if (isDemoMode()) {
    const category = (req.nextUrl.searchParams.get("category") || "").trim().toLowerCase();
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
    const limit = Math.max(1, Math.min(250, Number.isFinite(limitRaw) ? limitRaw : 50));

    const opportunities = getDemoDashboardSnapshot().opportunities
      .filter((item) => !category || category === "all" || String(item.category || "").toLowerCase() === category)
      .slice(0, limit);

    return NextResponse.json({ opportunities });
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
          "id,opportunity_type,service_line,title,description,location_text,postal_code,urgency_score,job_likelihood_score,contactability_score,source_reliability_score,revenue_band,catastrophe_linkage_score,routing_status,lifecycle_status,contact_status,explainability_json,created_at"
        )
        .eq("tenant_id", v2Context.franchiseTenantId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (category && category !== "all") query = query.eq("service_line", category);

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      return NextResponse.json({
        opportunities: (data || []).map((row: Record<string, unknown>) => {
          const explainability = (row.explainability_json as Record<string, unknown> | null) || {};
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
            qualification_status: qualification.qualificationStatus,
            qualification_reason_code: qualification.qualificationReasonCode,
            proof_authenticity: qualification.proofAuthenticity,
            source_lane: sourceLane,
            priority_score: priorityScore,
            next_recommended_action: qualification.nextRecommendedAction,
            research_only: qualification.researchOnly,
            requires_sdr_qualification: qualification.requiresSdrQualification,
            counts_as_real_capture: proofAuthenticity === "live_provider" || proofAuthenticity === "live_derived",
            counts_as_real_lead: qualification.qualificationStatus === "qualified_contactable" && qualification.proofAuthenticity !== "synthetic" && qualification.proofAuthenticity !== "unknown",
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

  return NextResponse.json({ opportunities: data || [] });
}
