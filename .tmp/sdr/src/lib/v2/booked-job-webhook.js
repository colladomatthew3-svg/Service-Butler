"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processBookedJobWebhook = processBookedJobWebhook;
function isValidIso(value) {
    if (typeof value !== "string" || !value.trim())
        return false;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed);
}
function normalizeMoney(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function webhookEventKey(payload) {
    const explicit = String(payload.webhookEventId || "").trim();
    if (explicit)
        return explicit;
    const externalCrmId = String(payload.externalCrmId || "none").trim() || "none";
    return `crm.job_booked:${payload.tenantId}:${payload.jobId}:${externalCrmId}`;
}
async function resolveLegacyAccountIdForTenant({ supabase, tenantId }) {
    const { data } = await supabase
        .from("v2_account_tenant_map")
        .select("account_id")
        .or(`franchise_tenant_id.eq.${tenantId},enterprise_tenant_id.eq.${tenantId}`)
        .limit(1)
        .maybeSingle();
    return data?.account_id ? String(data.account_id) : null;
}
async function markWebhookEventProcessing({ supabase, tenantId, eventId, payload }) {
    const accountId = await resolveLegacyAccountIdForTenant({ supabase, tenantId });
    const { error } = await supabase.from("webhook_events").insert({
        provider: "crm",
        event_id: eventId,
        payload,
        account_id: accountId,
        processed_at: new Date().toISOString()
    });
    if (!error)
        return { duplicate: false };
    if (error.code === "23505")
        return { duplicate: true };
    throw new Error(error.message || "Webhook idempotency failed");
}
async function resolveAttribution({ supabase, tenantId, leadId, explicitOpportunityId, explicitSourceEventId, explicitCampaignId }) {
    let primaryOpportunityId = explicitOpportunityId;
    let sourceEventId = explicitSourceEventId;
    const campaignId = explicitCampaignId;
    if (!primaryOpportunityId && leadId) {
        const { data: lead } = await supabase
            .from("v2_leads")
            .select("opportunity_id")
            .eq("tenant_id", tenantId)
            .eq("id", leadId)
            .maybeSingle();
        if (lead?.opportunity_id) {
            primaryOpportunityId = String(lead.opportunity_id);
        }
    }
    if ((primaryOpportunityId && !sourceEventId) || (primaryOpportunityId && !campaignId)) {
        const { data: opportunity } = await supabase
            .from("v2_opportunities")
            .select("source_event_id")
            .eq("tenant_id", tenantId)
            .eq("id", primaryOpportunityId)
            .maybeSingle();
        if (opportunity?.source_event_id && !sourceEventId) {
            sourceEventId = String(opportunity.source_event_id);
        }
    }
    return {
        primaryOpportunityId: primaryOpportunityId || null,
        sourceEventId: sourceEventId || null,
        campaignId: campaignId || null,
        confidence: primaryOpportunityId ? 85 : 45
    };
}
async function processBookedJobWebhook({ supabase, payload }) {
    const tenantId = String(payload.tenantId || "").trim();
    const jobId = String(payload.jobId || "").trim();
    if (!tenantId || !jobId) {
        throw new Error("tenantId and jobId are required");
    }
    const idempotency = await markWebhookEventProcessing({
        supabase,
        tenantId,
        eventId: webhookEventKey({ ...payload, tenantId, jobId }),
        payload
    });
    if (idempotency.duplicate) {
        return {
            received: true,
            duplicate: true,
            jobId,
            attribution: {
                primaryOpportunityId: payload.primaryOpportunityId || null,
                sourceEventId: payload.sourceEventId || null,
                campaignId: payload.campaignId || null,
                confidence: payload.primaryOpportunityId ? 85 : 45
            }
        };
    }
    const leadId = payload.leadId ? String(payload.leadId) : null;
    const { error: jobError } = await supabase.from("v2_jobs").upsert({
        id: jobId,
        tenant_id: tenantId,
        lead_id: leadId,
        external_crm_id: payload.externalCrmId ? String(payload.externalCrmId) : null,
        job_type: payload.jobType ? String(payload.jobType) : null,
        booked_at: isValidIso(payload.bookedAt) ? String(payload.bookedAt) : new Date().toISOString(),
        scheduled_at: isValidIso(payload.scheduledAt) ? String(payload.scheduledAt) : null,
        revenue_amount: normalizeMoney(payload.revenueAmount),
        status: payload.status ? String(payload.status) : "booked"
    }, { onConflict: "id" });
    if (jobError)
        throw new Error(jobError.message || "Failed to upsert job");
    const attribution = await resolveAttribution({
        supabase,
        tenantId,
        leadId,
        explicitOpportunityId: payload.primaryOpportunityId ? String(payload.primaryOpportunityId) : null,
        explicitSourceEventId: payload.sourceEventId ? String(payload.sourceEventId) : null,
        explicitCampaignId: payload.campaignId ? String(payload.campaignId) : null
    });
    const { error: attributionError } = await supabase.from("v2_job_attributions").upsert({
        tenant_id: tenantId,
        job_id: jobId,
        primary_opportunity_id: attribution.primaryOpportunityId,
        source_event_id: attribution.sourceEventId,
        campaign_id: attribution.campaignId,
        attribution_confidence: attribution.confidence,
        locked: true
    }, { onConflict: "job_id" });
    if (attributionError)
        throw new Error(attributionError.message || "Failed to upsert job attribution");
    if (attribution.primaryOpportunityId) {
        await supabase
            .from("v2_opportunities")
            .update({
            lifecycle_status: "booked_job",
            routing_status: "complete"
        })
            .eq("tenant_id", tenantId)
            .eq("id", attribution.primaryOpportunityId);
    }
    await supabase.from("v2_audit_logs").insert({
        tenant_id: tenantId,
        actor_type: "webhook",
        actor_id: "crm.job_booked",
        entity_type: "job",
        entity_id: jobId,
        action: "crm_job_booked",
        before_json: null,
        after_json: {
            webhook_event_id: webhookEventKey({ ...payload, tenantId, jobId }),
            duplicate: false,
            attribution
        }
    });
    return {
        received: true,
        duplicate: false,
        jobId,
        attribution
    };
}
