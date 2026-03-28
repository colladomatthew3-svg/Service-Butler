"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const scoring_1 = require("../src/lib/v2/scoring");
(0, test_1.test)("v2 scoring returns bounded explainable scores", () => {
    const result = (0, scoring_1.computeOpportunityScores)({
        sourceType: "weather_alert",
        eventRecencyMinutes: 15,
        severity: 90,
        geographyMatch: 85,
        propertyTypeFit: 75,
        serviceLineFit: 90,
        priorCustomerMatch: 35,
        contactAvailability: 70,
        supportingSignalsCount: 4,
        catastropheSignal: 95,
        sourceReliability: 88
    });
    (0, test_1.expect)(result.urgencyScore).toBeGreaterThanOrEqual(0);
    (0, test_1.expect)(result.urgencyScore).toBeLessThanOrEqual(100);
    (0, test_1.expect)(result.jobLikelihoodScore).toBeGreaterThanOrEqual(0);
    (0, test_1.expect)(result.jobLikelihoodScore).toBeLessThanOrEqual(100);
    (0, test_1.expect)(result.contactabilityScore).toBeGreaterThanOrEqual(0);
    (0, test_1.expect)(result.contactabilityScore).toBeLessThanOrEqual(100);
    (0, test_1.expect)(["low", "medium", "high", "enterprise"]).toContain(result.revenueBand);
    (0, test_1.expect)(result.explainability.source_type).toBe("weather_alert");
});
(0, test_1.test)("v2 scoring escalates revenue band for stronger job signals", () => {
    const weak = (0, scoring_1.computeOpportunityScores)({
        sourceType: "social_intent",
        eventRecencyMinutes: 2000,
        severity: 20,
        geographyMatch: 30,
        propertyTypeFit: 30,
        serviceLineFit: 35,
        priorCustomerMatch: 10,
        contactAvailability: 20,
        supportingSignalsCount: 1,
        catastropheSignal: 0,
        sourceReliability: 35
    });
    const strong = (0, scoring_1.computeOpportunityScores)({
        sourceType: "weather_alert",
        eventRecencyMinutes: 5,
        severity: 95,
        geographyMatch: 95,
        propertyTypeFit: 85,
        serviceLineFit: 95,
        priorCustomerMatch: 70,
        contactAvailability: 90,
        supportingSignalsCount: 6,
        catastropheSignal: 90,
        sourceReliability: 90
    });
    const rank = { low: 0, medium: 1, high: 2, enterprise: 3 };
    (0, test_1.expect)(rank[strong.revenueBand]).toBeGreaterThan(rank[weak.revenueBand]);
    (0, test_1.expect)(strong.jobLikelihoodScore).toBeGreaterThan(weak.jobLikelihoodScore);
});
