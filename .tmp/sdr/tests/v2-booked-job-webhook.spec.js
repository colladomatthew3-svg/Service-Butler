"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const booked_job_webhook_1 = require("../src/lib/v2/booked-job-webhook");
function createSupabaseMock(config) {
    const state = {
        duplicateWebhook: Boolean(config.duplicateWebhook),
        leadOpportunityId: config.leadOpportunityId ?? null,
        opportunitySourceEventId: config.opportunitySourceEventId ?? null,
        webhookInsertCount: 0,
        jobUpsertCount: 0,
        attributionUpsertCount: 0,
        opportunityUpdateCount: 0,
        auditInsertCount: 0,
        lastAttributionPayload: null
    };
    const client = {
        from: (table) => {
            if (table === "v2_account_tenant_map") {
                return {
                    select: () => ({
                        or: () => ({
                            limit: () => ({
                                maybeSingle: async () => ({ data: { account_id: "acc-1" }, error: null })
                            })
                        })
                    })
                };
            }
            if (table === "webhook_events") {
                return {
                    insert: async () => {
                        state.webhookInsertCount += 1;
                        if (state.duplicateWebhook) {
                            return { error: { code: "23505", message: "duplicate key value" } };
                        }
                        return { error: null };
                    }
                };
            }
            if (table === "v2_jobs") {
                return {
                    upsert: async () => {
                        state.jobUpsertCount += 1;
                        return { error: null };
                    }
                };
            }
            if (table === "v2_leads") {
                const filters = {};
                const builder = {
                    select: () => builder,
                    eq: (field, value) => {
                        filters[field] = value;
                        return builder;
                    },
                    maybeSingle: async () => ({
                        data: state.leadOpportunityId ? { opportunity_id: state.leadOpportunityId } : null,
                        error: null
                    })
                };
                return builder;
            }
            if (table === "v2_opportunities") {
                const filters = {};
                const selectBuilder = {
                    select: () => selectBuilder,
                    eq: (field, value) => {
                        filters[field] = value;
                        return selectBuilder;
                    },
                    maybeSingle: async () => ({
                        data: state.opportunitySourceEventId ? { source_event_id: state.opportunitySourceEventId } : null,
                        error: null
                    })
                };
                const updateBuilder = {
                    update: () => ({
                        eq: () => ({
                            eq: async () => {
                                state.opportunityUpdateCount += 1;
                                return { data: null, error: null };
                            }
                        })
                    })
                };
                return {
                    ...selectBuilder,
                    ...updateBuilder
                };
            }
            if (table === "v2_job_attributions") {
                return {
                    upsert: async (payload) => {
                        state.attributionUpsertCount += 1;
                        state.lastAttributionPayload = payload;
                        return { error: null };
                    }
                };
            }
            if (table === "v2_audit_logs") {
                return {
                    insert: async () => {
                        state.auditInsertCount += 1;
                        return { error: null };
                    }
                };
            }
            throw new Error(`Unexpected table ${table}`);
        }
    };
    return { client: client, state };
}
(0, test_1.test)("booked job webhook maps lead to opportunity attribution", async () => {
    const { client, state } = createSupabaseMock({
        leadOpportunityId: "opp-1",
        opportunitySourceEventId: "src-1"
    });
    const result = await (0, booked_job_webhook_1.processBookedJobWebhook)({
        supabase: client,
        payload: {
            tenantId: "tenant-1",
            jobId: "job-1",
            leadId: "lead-1",
            webhookEventId: "evt-1"
        }
    });
    (0, test_1.expect)(result.duplicate).toBeFalsy();
    (0, test_1.expect)(result.attribution.primaryOpportunityId).toBe("opp-1");
    (0, test_1.expect)(result.attribution.sourceEventId).toBe("src-1");
    (0, test_1.expect)(state.webhookInsertCount).toBe(1);
    (0, test_1.expect)(state.jobUpsertCount).toBe(1);
    (0, test_1.expect)(state.attributionUpsertCount).toBe(1);
    (0, test_1.expect)(state.opportunityUpdateCount).toBe(1);
    (0, test_1.expect)(state.auditInsertCount).toBe(1);
    (0, test_1.expect)(state.lastAttributionPayload?.primary_opportunity_id).toBe("opp-1");
});
(0, test_1.test)("booked job webhook without match keeps attribution nullable", async () => {
    const { client, state } = createSupabaseMock({
        leadOpportunityId: null,
        opportunitySourceEventId: null
    });
    const result = await (0, booked_job_webhook_1.processBookedJobWebhook)({
        supabase: client,
        payload: {
            tenantId: "tenant-1",
            jobId: "job-2",
            leadId: "lead-2"
        }
    });
    (0, test_1.expect)(result.duplicate).toBeFalsy();
    (0, test_1.expect)(result.attribution.primaryOpportunityId).toBeNull();
    (0, test_1.expect)(result.attribution.sourceEventId).toBeNull();
    (0, test_1.expect)(state.attributionUpsertCount).toBe(1);
    (0, test_1.expect)(state.opportunityUpdateCount).toBe(0);
});
(0, test_1.test)("duplicate webhook short-circuits writes", async () => {
    const { client, state } = createSupabaseMock({
        duplicateWebhook: true,
        leadOpportunityId: "opp-1",
        opportunitySourceEventId: "src-1"
    });
    const result = await (0, booked_job_webhook_1.processBookedJobWebhook)({
        supabase: client,
        payload: {
            tenantId: "tenant-1",
            jobId: "job-3",
            leadId: "lead-3",
            webhookEventId: "evt-duplicate"
        }
    });
    (0, test_1.expect)(result.duplicate).toBeTruthy();
    (0, test_1.expect)(state.webhookInsertCount).toBe(1);
    (0, test_1.expect)(state.jobUpsertCount).toBe(0);
    (0, test_1.expect)(state.attributionUpsertCount).toBe(0);
    (0, test_1.expect)(state.auditInsertCount).toBe(0);
});
