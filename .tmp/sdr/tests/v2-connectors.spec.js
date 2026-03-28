"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const weather_1 = require("../src/lib/v2/connectors/weather");
const incidents_1 = require("../src/lib/v2/connectors/incidents");
(0, test_1.test)("weather connector normalizes and classifies NOAA-like records", async () => {
    const events = await weather_1.weatherConnector.normalize([
        {
            id: "abc-1",
            properties: {
                event: "Flood Warning",
                headline: "Flood Warning for county",
                description: "Rising water expected",
                severity: "Severe",
                urgency: "Immediate",
                sent: "2026-03-14T05:00:00.000Z",
                areaDesc: "Suffolk County, NY"
            }
        }
    ], {
        tenantId: "tenant-1",
        sourceId: "source-1",
        sourceType: "weather",
        config: {}
    });
    (0, test_1.expect)(events).toHaveLength(1);
    const classification = weather_1.weatherConnector.classify(events[0]);
    (0, test_1.expect)(classification.serviceLine).toBe("restoration");
    (0, test_1.expect)(classification.opportunityType).toContain("storm");
});
(0, test_1.test)("incident connector is compliance-gated by default", () => {
    const policy = incidents_1.incidentConnector.compliancePolicy({
        tenantId: "tenant-1",
        sourceId: "source-1",
        sourceType: "incident",
        config: {}
    });
    (0, test_1.expect)(policy.requiresLegalReview).toBeTruthy();
    (0, test_1.expect)(policy.outboundAllowed).toBeFalsy();
});
