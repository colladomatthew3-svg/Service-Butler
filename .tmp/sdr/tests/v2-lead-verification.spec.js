"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const lead_verification_1 = require("../src/lib/v2/lead-verification");
(0, test_1.test)("lead verification normalizes phone/email safely", () => {
    (0, test_1.expect)((0, lead_verification_1.normalizePhone)("(631) 555-0199")).toBe("+16315550199");
    (0, test_1.expect)((0, lead_verification_1.normalizePhone)("1-516-222-8888")).toBe("+15162228888");
    (0, test_1.expect)((0, lead_verification_1.normalizePhone)("abc")).toBeNull();
    (0, test_1.expect)((0, lead_verification_1.normalizeEmail)("Ops@Example.org ")).toBe("ops@example.org");
    (0, test_1.expect)((0, lead_verification_1.normalizeEmail)("invalid-email")).toBeNull();
});
(0, test_1.test)("lead verification extracts contact from source event payload", () => {
    const candidate = (0, lead_verification_1.extractLeadContactCandidate)({
        sourceEvent: {
            normalized_payload: {
                contact_name: "Harbor Property Group",
                contact_phone: "516-222-8888",
                contact_email: "ops@harborpm.com"
            }
        },
        opportunity: {
            title: "Commercial property alert"
        }
    });
    (0, test_1.expect)(candidate.name).toBe("Harbor Property Group");
    (0, test_1.expect)(candidate.phone).toBe("+15162228888");
    (0, test_1.expect)(candidate.email).toBe("ops@harborpm.com");
    (0, test_1.expect)(candidate.evidence.length).toBeGreaterThan(0);
});
(0, test_1.test)("lead verification rejects placeholder contact and verifies real contact", () => {
    const rejected = (0, lead_verification_1.verifyLeadContactCandidate)({
        name: "Test Contact",
        phone: "+16315550123",
        email: "demo@example.com",
        provenance: "source:test",
        evidence: ["source:phone", "source:email"]
    }, {
        sourceReliability: 80,
        freshnessScore: 85,
        hasMultiSignal: true,
        duplicatePhone: false,
        duplicateEmail: false,
        duplicateAddress: false
    });
    (0, test_1.expect)(rejected.status).toBe("rejected");
    (0, test_1.expect)(rejected.contactable).toBeFalsy();
    const verified = (0, lead_verification_1.verifyLeadContactCandidate)({
        name: "Harbor Property Group",
        phone: "+15162228888",
        email: "ops@harborpm.com",
        provenance: "source:overpass",
        evidence: ["source:phone", "source:email"]
    }, {
        sourceReliability: 82,
        freshnessScore: 78,
        hasMultiSignal: true,
        duplicatePhone: false,
        duplicateEmail: false,
        duplicateAddress: false
    });
    (0, test_1.expect)(verified.status).toBe("verified");
    (0, test_1.expect)(verified.score).toBeGreaterThanOrEqual(70);
    (0, test_1.expect)(verified.contactable).toBeTruthy();
});
