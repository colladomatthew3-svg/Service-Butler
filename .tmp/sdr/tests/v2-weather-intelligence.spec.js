"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const weather_1 = require("../src/lib/v2/connectors/weather");
(0, test_1.test)("weather intelligence normalizes storm/hail/freeze/flood categories with service-line mapping", async () => {
    const input = {
        tenantId: "tenant-1",
        sourceId: "source-weather-1",
        sourceType: "weather",
        config: {
            latitude: 40.7128,
            longitude: -74.006,
            city: "New York",
            state: "NY",
            postal_code: "10001",
            source_name: "NOAA"
        }
    };
    const events = await weather_1.weatherConnector.normalize([
        {
            id: "hail-1",
            properties: {
                event: "Severe Thunderstorm Warning",
                headline: "Hail and wind in area",
                severity: "Severe",
                urgency: "Immediate",
                sent: "2026-03-16T10:00:00.000Z",
                areaDesc: "Manhattan, NY"
            }
        },
        {
            id: "freeze-1",
            properties: {
                event: "Freeze Warning",
                headline: "Freeze conditions expected",
                severity: "Moderate",
                urgency: "Expected",
                sent: "2026-03-16T11:00:00.000Z",
                areaDesc: "Queens, NY"
            }
        },
        {
            id: "flood-1",
            properties: {
                event: "Flood Warning",
                headline: "Flood waters rising",
                severity: "Extreme",
                urgency: "Immediate",
                sent: "2026-03-16T12:00:00.000Z",
                areaDesc: "Brooklyn, NY"
            }
        }
    ], input);
    (0, test_1.expect)(events).toHaveLength(3);
    const [storm, freeze, flood] = events;
    (0, test_1.expect)(storm?.eventCategory).toBe("storm");
    (0, test_1.expect)(storm?.serviceLineCandidates).toContain("roofing");
    (0, test_1.expect)(storm?.serviceLineCandidates).toContain("restoration");
    (0, test_1.expect)(storm?.normalizedPayload.connector_version).toBeTruthy();
    (0, test_1.expect)(freeze?.eventCategory).toBe("freeze");
    (0, test_1.expect)(freeze?.serviceLineCandidates).toContain("plumbing");
    (0, test_1.expect)(freeze?.serviceLineCandidates).toContain("hvac");
    (0, test_1.expect)(freeze?.likelyJobType).toBe("emergency plumbing");
    (0, test_1.expect)(flood?.eventCategory).toBe("flood");
    (0, test_1.expect)(flood?.serviceLineCandidates).toContain("restoration");
    (0, test_1.expect)(flood?.serviceLineCandidates).toContain("plumbing");
    (0, test_1.expect)(flood?.urgencyHint).toBeGreaterThanOrEqual(80);
});
(0, test_1.test)("weather intelligence classification maps severe categories to expected opportunity types", async () => {
    const [hailEvent] = await weather_1.weatherConnector.normalize([
        {
            id: "hail-2",
            properties: {
                event: "Hail Warning",
                headline: "Large hail expected",
                severity: "Severe",
                urgency: "Immediate",
                sent: "2026-03-16T13:00:00.000Z",
                areaDesc: "Bronx, NY"
            }
        }
    ], {
        tenantId: "tenant-1",
        sourceId: "source-weather-2",
        sourceType: "weather",
        config: {}
    });
    (0, test_1.expect)(hailEvent).toBeTruthy();
    const classification = weather_1.weatherConnector.classify(hailEvent);
    (0, test_1.expect)(classification.opportunityType).toBe("roof_damage_risk");
    (0, test_1.expect)(classification.serviceLine).toBe("roofing");
});
