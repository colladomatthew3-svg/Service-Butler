"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const scoring_1 = require("../src/lib/v2/scoring");
const runner_1 = require("../src/lib/v2/connectors/runner");
(0, test_1.test)("multi-signal scoring increases confidence with stronger source agreement", () => {
    const lowAgreement = (0, scoring_1.computeOpportunityScores)({
        sourceType: "weather_storm_alert",
        eventRecencyMinutes: 30,
        severity: 72,
        geographyMatch: 70,
        geographyPrecision: 70,
        propertyTypeFit: 55,
        serviceLineFit: 78,
        priorCustomerMatch: 30,
        contactAvailability: 45,
        supportingSignalsCount: 1,
        catastropheSignal: 70,
        sourceReliability: 82,
        signalAgreement: 45
    });
    const highAgreement = (0, scoring_1.computeOpportunityScores)({
        sourceType: "weather_storm_alert",
        eventRecencyMinutes: 30,
        severity: 72,
        geographyMatch: 70,
        geographyPrecision: 70,
        propertyTypeFit: 55,
        serviceLineFit: 78,
        priorCustomerMatch: 30,
        contactAvailability: 45,
        supportingSignalsCount: 3,
        catastropheSignal: 70,
        sourceReliability: 82,
        signalAgreement: 90
    });
    (0, test_1.expect)(highAgreement.confidenceScore).toBeGreaterThan(lowAgreement.confidenceScore);
    (0, test_1.expect)(highAgreement.explainability.signal_agreement).toBe(90);
});
(0, test_1.test)("score merge marks opportunities as multi-signal when distinct sources agree", () => {
    const incoming = (0, scoring_1.computeOpportunityScores)({
        sourceType: "google_review_distress",
        eventRecencyMinutes: 15,
        severity: 80,
        geographyMatch: 88,
        geographyPrecision: 90,
        propertyTypeFit: 50,
        serviceLineFit: 84,
        priorCustomerMatch: 40,
        contactAvailability: 52,
        supportingSignalsCount: 2,
        catastropheSignal: 58,
        sourceReliability: 70,
        signalAgreement: 78
    });
    const merged = runner_1.connectorRunnerInternals.mergeOpportunityScores({
        existing: {
            urgency_score: 74,
            job_likelihood_score: 69,
            source_reliability_score: 86,
            catastrophe_linkage_score: 65,
            explainability_json: {
                signal_count: 1,
                confidence_score: 71,
                source_types: ["weather_freeze_alert"]
            }
        },
        incoming,
        incomingConfidence: incoming.confidenceScore,
        sourceType: "google_review_distress"
    });
    (0, test_1.expect)(merged.signalCount).toBe(2);
    (0, test_1.expect)(merged.sourceTypes).toContain("weather_freeze_alert");
    (0, test_1.expect)(merged.sourceTypes).toContain("google_review_distress");
    (0, test_1.expect)(merged.multiSignal).toBeTruthy();
    (0, test_1.expect)(merged.confidenceScore).toBeGreaterThanOrEqual(70);
});
