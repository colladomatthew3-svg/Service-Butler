"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const permits_1 = require("../src/lib/v2/connectors/permits");
(0, test_1.test)("permits intelligence normalizes permit categories and demand timing", async () => {
    const events = await permits_1.permitsConnector.normalize([
        {
            id: "permit-1",
            permit_type: "Roof Repair",
            work_class: "Emergency leak repair",
            description: "Emergency roof leak after storm damage",
            occurred_at: "2026-03-16T09:30:00.000Z",
            address: "120 Broadway, New York, NY",
            postal_code: "10005"
        },
        {
            id: "permit-2",
            permit_type: "HVAC Replacement",
            work_class: "Equipment install",
            description: "Replace aging AC condenser",
            occurred_at: "2026-03-16T08:15:00.000Z",
            address: "50 W 23rd St, New York, NY",
            postal_code: "10010"
        }
    ], {
        tenantId: "tenant-1",
        sourceId: "source-permit-1",
        sourceType: "permits",
        config: {
            terms_status: "approved",
            source_name: "Municipal Permits",
            source_provenance: "nyc.permits.api"
        }
    });
    (0, test_1.expect)(events).toHaveLength(2);
    const roof = events[0];
    (0, test_1.expect)(roof.serviceLineCandidates).toContain("roofing");
    (0, test_1.expect)(roof.normalizedPayload.permit_category).toBe("roof");
    (0, test_1.expect)(roof.normalizedPayload.demand_timing).toBe("immediate_service_demand");
    (0, test_1.expect)(roof.normalizedPayload.work_class).toContain("Emergency");
    (0, test_1.expect)(roof.likelyJobType).toBe("roof damage inspection");
    const hvac = events[1];
    (0, test_1.expect)(hvac.serviceLineCandidates).toContain("hvac");
    (0, test_1.expect)(hvac.normalizedPayload.permit_category).toBe("hvac");
    (0, test_1.expect)(hvac.normalizedPayload.demand_timing).toBe("downstream_upsell");
    (0, test_1.expect)(typeof hvac.normalizedPayload.connector_version).toBe("string");
});
(0, test_1.test)("permits intelligence classification maps permit category to service line", async () => {
    const [event] = await permits_1.permitsConnector.normalize([
        {
            id: "permit-3",
            permit_type: "Plumbing Repair",
            work_class: "Pipe replacement",
            description: "Sewer and drain line repair",
            occurred_at: "2026-03-16T07:00:00.000Z"
        }
    ], {
        tenantId: "tenant-1",
        sourceId: "source-permit-2",
        sourceType: "permits",
        config: {
            terms_status: "approved"
        }
    });
    const classification = permits_1.permitsConnector.classify(event);
    (0, test_1.expect)(classification.opportunityType).toBe("plumbing_permit_signal");
    (0, test_1.expect)(classification.serviceLine).toBe("plumbing");
});
