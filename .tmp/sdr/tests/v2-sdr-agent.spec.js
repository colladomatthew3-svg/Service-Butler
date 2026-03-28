"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const sdr_agent_1 = require("../src/lib/v2/sdr-agent");
(0, test_1.test)("sdr agent blocks opportunities when source compliance is not approved", () => {
    const decision = sdr_agent_1.sdrAgentInternals.verifyCandidate({
        opportunity: {
            id: "opp-1",
            job_likelihood_score: 88,
            urgency_score: 84,
            source_reliability_score: 80,
            catastrophe_linkage_score: 70,
            location_text: "123 Main St, New York, NY 10001",
            postal_code: "10001",
            explainability_json: {
                signal_count: 2,
                confidence_score: 86
            }
        },
        sourceEvent: {
            compliance_status: "restricted",
            normalized_payload: {
                terms_status: "restricted",
                data_freshness_score: 92
            }
        },
        minJobLikelihood: 60,
        minUrgency: 55,
        minSourceReliability: 50
    });
    (0, test_1.expect)(decision.qualified).toBeFalsy();
    (0, test_1.expect)(decision.reasons.some((reason) => reason.includes("blocked: compliance_status"))).toBeTruthy();
});
(0, test_1.test)("sdr agent qualifies high quality multi-signal opportunities", () => {
    const decision = sdr_agent_1.sdrAgentInternals.verifyCandidate({
        opportunity: {
            id: "opp-2",
            job_likelihood_score: 79,
            urgency_score: 74,
            source_reliability_score: 82,
            catastrophe_linkage_score: 62,
            location_text: "Buffalo, NY 14201",
            postal_code: "14201",
            explainability_json: {
                signal_count: 3,
                confidence_score: 83
            }
        },
        sourceEvent: {
            compliance_status: "approved",
            normalized_payload: {
                terms_status: "approved",
                data_freshness_score: 88
            }
        },
        minJobLikelihood: 60,
        minUrgency: 55,
        minSourceReliability: 50
    });
    (0, test_1.expect)(decision.qualified).toBeTruthy();
    (0, test_1.expect)(decision.score).toBeGreaterThanOrEqual(70);
    (0, test_1.expect)(decision.reasons.some((reason) => reason.includes("multi-signal"))).toBeTruthy();
});
(0, test_1.test)("sdr agent sms template and city/state parsing remain operator-readable", () => {
    const parsed = sdr_agent_1.sdrAgentInternals.parseCityStatePostal("120 Main St, Albany, NY 12207");
    (0, test_1.expect)(parsed).toEqual({
        city: "Albany",
        state: "NY",
        postalCode: "12207"
    });
    const message = sdr_agent_1.sdrAgentInternals.buildSdrSmsMessage({
        serviceLine: "plumbing",
        title: "Freeze pipe risk",
        city: "Albany",
        state: "NY"
    });
    (0, test_1.expect)(message).toContain("plumbing");
    (0, test_1.expect)(message).toContain("Albany, NY");
});
