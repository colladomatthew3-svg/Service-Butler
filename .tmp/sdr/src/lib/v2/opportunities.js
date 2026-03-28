"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rescoreOpportunityV2 = rescoreOpportunityV2;
const scoring_1 = require("@/lib/v2/scoring");
const audit_1 = require("@/lib/v2/audit");
function deriveScoreInputFromSourceEvent(sourceEvent, opportunity) {
    const normalized = (sourceEvent.normalized_payload || {});
    const occurredAt = new Date(String(sourceEvent.occurred_at || sourceEvent.ingested_at || new Date().toISOString())).getTime();
    const ageMinutes = Math.max(0, Math.round((Date.now() - occurredAt) / 60000));
    const severity = Number(normalized.severity || sourceEvent.confidence_score || 50);
    const serviceLine = String(opportunity.service_line || opportunity.opportunity_type || "general");
    return {
        sourceType: String(sourceEvent.event_type || "signal"),
        eventRecencyMinutes: ageMinutes,
        severity,
        geographyMatch: opportunity.location_text ? 70 : 35,
        propertyTypeFit: Number(normalized.property_type_fit || 55),
        serviceLineFit: serviceLine === "general" ? 60 : 78,
        priorCustomerMatch: Number(normalized.prior_customer_match || 40),
        contactAvailability: Number(normalized.contact_availability || 45),
        supportingSignalsCount: Number(normalized.supporting_signals_count || 1),
        catastropheSignal: Number(normalized.catastrophe_signal || opportunity.catastrophe_linkage_score || 0),
        sourceReliability: Number(sourceEvent.source_reliability_score || 50)
    };
}
async function rescoreOpportunityV2({ supabase, tenantId, opportunityId, actorUserId }) {
    const { data: opportunity, error: opportunityError } = await supabase
        .from("v2_opportunities")
        .select("id,source_event_id,service_line,opportunity_type,location_text,catastrophe_linkage_score")
        .eq("id", opportunityId)
        .eq("tenant_id", tenantId)
        .single();
    if (opportunityError || !opportunity)
        throw new Error(opportunityError?.message || "Opportunity not found");
    if (!opportunity.source_event_id) {
        throw new Error("Opportunity has no source event to score");
    }
    const { data: sourceEvent, error: sourceEventError } = await supabase
        .from("v2_source_events")
        .select("id,event_type,occurred_at,ingested_at,normalized_payload,confidence_score,source_reliability_score")
        .eq("id", opportunity.source_event_id)
        .single();
    if (sourceEventError || !sourceEvent)
        throw new Error(sourceEventError?.message || "Source event not found");
    const next = (0, scoring_1.computeOpportunityScores)(deriveScoreInputFromSourceEvent(sourceEvent, opportunity));
    const { data: updated, error: updateError } = await supabase
        .from("v2_opportunities")
        .update({
        urgency_score: next.urgencyScore,
        job_likelihood_score: next.jobLikelihoodScore,
        contactability_score: next.contactabilityScore,
        source_reliability_score: next.sourceReliabilityScore,
        revenue_band: next.revenueBand,
        catastrophe_linkage_score: next.catastropheLinkageScore,
        explainability_json: next.explainability
    })
        .eq("id", opportunityId)
        .select("id,urgency_score,job_likelihood_score,contactability_score,source_reliability_score,revenue_band,catastrophe_linkage_score")
        .single();
    if (updateError || !updated)
        throw new Error(updateError?.message || "Could not update opportunity score");
    await supabase
        .from("v2_opportunity_signals")
        .insert([
        {
            tenant_id: tenantId,
            opportunity_id: opportunityId,
            signal_key: "rescored_at",
            signal_value: Date.now(),
            signal_weight: 1,
            explanation: "Opportunity rescored via API"
        },
        {
            tenant_id: tenantId,
            opportunity_id: opportunityId,
            signal_key: "job_likelihood_score",
            signal_value: next.jobLikelihoodScore,
            signal_weight: 1,
            explanation: "Updated job likelihood"
        }
    ]);
    await (0, audit_1.logV2AuditEvent)({
        tenantId,
        actorType: "user",
        actorId: actorUserId,
        entityType: "opportunity",
        entityId: opportunityId,
        action: "rescored",
        before: null,
        after: {
            urgency_score: next.urgencyScore,
            job_likelihood_score: next.jobLikelihoodScore,
            contactability_score: next.contactabilityScore,
            source_reliability_score: next.sourceReliabilityScore,
            revenue_band: next.revenueBand,
            catastrophe_linkage_score: next.catastropheLinkageScore
        }
    });
    return updated;
}
