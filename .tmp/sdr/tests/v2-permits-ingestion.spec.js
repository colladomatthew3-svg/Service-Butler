"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const permits_1 = require("../src/lib/v2/connectors/permits");
const runner_1 = require("../src/lib/v2/connectors/runner");
const runner_2 = require("../src/lib/v2/connectors/runner");
(0, test_1.test)("permits connector normalization includes required provenance/compliance metadata", async () => {
    const input = {
        tenantId: "tenant-1",
        sourceId: "source-1",
        sourceType: "permits",
        config: {
            source_provenance: "permits.test.provider",
            terms_status: "approved"
        }
    };
    const records = [
        {
            id: "permit-123",
            permit_type: "Roof Repair",
            occurred_at: "2026-03-14T12:00:00.000Z",
            address: "101 Main St, Albany, NY",
            severity: 70
        }
    ];
    const events = await permits_1.permitsConnector.normalize(records, input);
    (0, test_1.expect)(events).toHaveLength(1);
    const normalized = events[0]?.normalizedPayload || {};
    (0, test_1.expect)(normalized.source_provenance).toBe("permits.test.provider");
    (0, test_1.expect)(normalized.terms_status).toBe("approved");
    (0, test_1.expect)(typeof normalized.data_freshness_score).toBe("number");
    (0, test_1.expect)(typeof normalized.connector_version).toBe("string");
});
(0, test_1.test)("permits compliance policy blocks ingestion when terms are not approved", () => {
    const restricted = permits_1.permitsConnector.compliancePolicy({
        tenantId: "tenant-1",
        sourceId: "source-1",
        sourceType: "permits",
        config: {
            terms_status: "restricted"
        }
    });
    (0, test_1.expect)(restricted.ingestionAllowed).toBeFalsy();
    (0, test_1.expect)(restricted.requiresLegalReview).toBeTruthy();
});
(0, test_1.test)("connector runner does not process opportunities when compliance ingestion is denied", async () => {
    let pullCalled = false;
    const connector = {
        key: "test.denied",
        pull: async () => {
            pullCalled = true;
            return [];
        },
        normalize: async () => [],
        dedupeKey: () => "dedupe",
        classify: () => ({ opportunityType: "permit_signal", serviceLine: "restoration" }),
        compliancePolicy: () => ({
            termsStatus: "restricted",
            ingestionAllowed: false,
            outboundAllowed: false,
            requiresLegalReview: true
        }),
        healthcheck: async () => ({ ok: true })
    };
    const touchedTables = [];
    const supabaseMock = {
        from: (table) => {
            touchedTables.push(table);
            if (table === "v2_connector_runs") {
                const connectorRunBuilder = {
                    insert: () => ({
                        select: () => ({
                            single: async () => ({ data: { id: "run-1" }, error: null })
                        })
                    }),
                    update: () => ({
                        eq: async () => ({ data: null, error: null })
                    })
                };
                return connectorRunBuilder;
            }
            throw new Error(`Unexpected table access: ${table}`);
        }
    };
    const result = await (0, runner_2.runConnectorForSource)({
        supabase: supabaseMock,
        tenantId: "tenant-1",
        sourceId: "source-1",
        sourceType: "permits",
        sourceConfig: { terms_status: "restricted" },
        actorUserId: "user-1",
        connector
    });
    (0, test_1.expect)(result.status).toBe("failed");
    (0, test_1.expect)(result.recordsCreated).toBe(0);
    (0, test_1.expect)(pullCalled).toBeFalsy();
    (0, test_1.expect)(touchedTables).toEqual(["v2_connector_runs", "v2_connector_runs"]);
});
(0, test_1.test)("connector validation layer always provides required source_event metadata keys", () => {
    const enriched = runner_1.connectorRunnerInternals.ensureSourceMetadata({
        connectorKey: "weather.noaa",
        complianceTermsStatus: "approved",
        event: {
            occurredAt: "2026-03-15T08:00:00.000Z",
            dedupeKey: "dedupe-1",
            eventType: "weather_signal",
            title: "Weather alert",
            rawPayload: {},
            normalizedPayload: {}
        }
    });
    (0, test_1.expect)(typeof enriched.source_provenance).toBe("string");
    (0, test_1.expect)(typeof enriched.connector_version).toBe("string");
    (0, test_1.expect)(typeof enriched.terms_status).toBe("string");
    (0, test_1.expect)(typeof enriched.data_freshness_score).toBe("number");
});
