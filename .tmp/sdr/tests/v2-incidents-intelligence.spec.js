"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const incidents_1 = require("../src/lib/v2/connectors/incidents");
const runner_1 = require("../src/lib/v2/connectors/runner");
(0, test_1.test)("incident intelligence normalizes fire/water/infrastructure categories", async () => {
    const events = await incidents_1.incidentConnector.normalize([
        {
            id: "inc-1",
            event_type: "Fire Response",
            title: "Apartment fire with smoke damage",
            occurred_at: "2026-03-16T09:00:00.000Z",
            city: "New York",
            state: "NY"
        },
        {
            id: "inc-2",
            event_type: "Flood Response",
            title: "Water main break and basement flooding",
            occurred_at: "2026-03-16T10:00:00.000Z"
        },
        {
            id: "inc-3",
            event_type: "Utility Outage",
            title: "Infrastructure outage event",
            occurred_at: "2026-03-16T11:00:00.000Z"
        }
    ], {
        tenantId: "tenant-1",
        sourceId: "source-incident-1",
        sourceType: "incident",
        config: {
            source_name: "Public Incident Feed",
            source_provenance: "city.incidents",
            terms_status: "approved"
        }
    });
    (0, test_1.expect)(events).toHaveLength(3);
    (0, test_1.expect)(events[0]?.eventCategory).toBe("fire_incident");
    (0, test_1.expect)(events[0]?.likelyJobType).toBe("fire restoration");
    (0, test_1.expect)(events[1]?.eventCategory).toBe("water_incident");
    (0, test_1.expect)(events[1]?.serviceLineCandidates).toContain("plumbing");
    (0, test_1.expect)(events[2]?.eventCategory).toBe("infrastructure_failure");
    (0, test_1.expect)(events[2]?.serviceLineCandidates).toContain("electrical");
});
(0, test_1.test)("incident connector keeps Citizen-like sources compliance-gated by default", () => {
    delete process.env.SB_ENABLE_CITIZEN_CONNECTOR;
    const policy = incidents_1.incidentConnector.compliancePolicy({
        tenantId: "tenant-1",
        sourceId: "source-incident-2",
        sourceType: "incident",
        config: {
            source_name: "Citizen Feed",
            terms_status: "approved"
        }
    });
    (0, test_1.expect)(policy.ingestionAllowed).toBeFalsy();
    (0, test_1.expect)(policy.requiresLegalReview).toBeTruthy();
    (0, test_1.expect)(policy.termsStatus).toBe("restricted");
});
(0, test_1.test)("incident cluster logic groups nearby events inside the active time window", async () => {
    const clusters = [];
    const supabaseMock = {
        from: (table) => {
            if (table !== "v2_incident_clusters")
                throw new Error(`Unexpected table ${table}`);
            const filters = {};
            const builder = {
                select: () => builder,
                eq: (field, value) => {
                    filters[field] = value;
                    return builder;
                },
                order: () => builder,
                limit: () => builder,
                then: (resolve, reject) => {
                    let data = clusters.slice();
                    if (filters.tenant_id)
                        data = data.filter((row) => row.tenant_id === filters.tenant_id);
                    if (filters.cluster_type)
                        data = data.filter((row) => row.cluster_type === filters.cluster_type);
                    if (filters.status)
                        data = data.filter((row) => row.status === filters.status);
                    return Promise.resolve({ data, error: null }).then(resolve, reject);
                },
                update: (patch) => ({
                    eq: async (_field, value) => {
                        const idx = clusters.findIndex((row) => String(row.id) === String(value));
                        if (idx >= 0)
                            clusters[idx] = { ...clusters[idx], ...patch };
                        return { data: null, error: null };
                    }
                }),
                insert: (row) => ({
                    select: () => ({
                        single: async () => {
                            const inserted = {
                                id: `cluster-${clusters.length + 1}`,
                                ...row
                            };
                            clusters.push(inserted);
                            return { data: { id: inserted.id }, error: null };
                        }
                    })
                })
            };
            return builder;
        }
    };
    const first = await runner_1.connectorRunnerInternals.upsertIncidentClusterFromEvent({
        supabase: supabaseMock,
        tenantId: "tenant-1",
        event: {
            occurredAt: "2026-03-16T12:00:00.000Z",
            dedupeKey: "incident-1",
            eventType: "fire_incident",
            eventCategory: "fire_incident",
            title: "Fire response",
            latitude: 40.7484,
            longitude: -73.9857,
            severityHint: 86,
            rawPayload: {},
            normalizedPayload: {}
        }
    });
    const second = await runner_1.connectorRunnerInternals.upsertIncidentClusterFromEvent({
        supabase: supabaseMock,
        tenantId: "tenant-1",
        event: {
            occurredAt: "2026-03-16T12:20:00.000Z",
            dedupeKey: "incident-2",
            eventType: "fire_incident",
            eventCategory: "fire_incident",
            title: "Smoke damage follow-up",
            latitude: 40.749,
            longitude: -73.9862,
            severityHint: 80,
            rawPayload: {},
            normalizedPayload: {}
        }
    });
    (0, test_1.expect)(first?.clusterId).toBeTruthy();
    (0, test_1.expect)(second?.clusterId).toBe(first?.clusterId);
    (0, test_1.expect)(second?.signalCount).toBe(2);
});
