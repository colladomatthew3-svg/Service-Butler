"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const social_1 = require("../src/lib/v2/connectors/social");
(0, test_1.test)("distress connector classifies reddit flood distress into water mitigation opportunity", async () => {
    const [event] = await social_1.socialIntentConnector.normalize([
        {
            id: "reddit-1",
            platform: "reddit",
            title: "Help - flooded basement after pipe burst",
            body: "Our basement is flooded and water keeps leaking from a burst pipe.",
            created_at: "2026-03-16T13:00:00.000Z",
            city: "Buffalo",
            state: "NY",
            postal_code: "14201"
        }
    ], {
        tenantId: "tenant-1",
        sourceId: "source-social-1",
        sourceType: "social",
        config: {
            terms_status: "approved",
            source_name: "Reddit"
        }
    });
    (0, test_1.expect)(event).toBeTruthy();
    (0, test_1.expect)(event?.eventType).toBe("reddit_distress_post");
    (0, test_1.expect)(event?.serviceLineCandidates).toContain("restoration");
    (0, test_1.expect)(event?.serviceLineCandidates).toContain("plumbing");
    (0, test_1.expect)(event?.likelyJobType).toBe("water mitigation");
    (0, test_1.expect)(event?.distressContextSummary).toContain("flooded basement");
    const classification = social_1.socialIntentConnector.classify(event);
    (0, test_1.expect)(classification.opportunityType).toBe("water_damage_distress");
    (0, test_1.expect)(classification.serviceLine).toBe("restoration");
});
(0, test_1.test)("distress connector classifies google review no-heat issues into HVAC urgency", async () => {
    const [event] = await social_1.socialIntentConnector.normalize([
        {
            id: "review-1",
            platform: "google_review",
            title: "No heat in house",
            review_text: "No heat for two days and pipes may freeze",
            created_at: "2026-03-16T14:00:00.000Z",
            city: "Syracuse",
            state: "NY"
        }
    ], {
        tenantId: "tenant-1",
        sourceId: "source-social-2",
        sourceType: "social",
        config: {
            terms_status: "approved",
            source_name: "Google Reviews"
        }
    });
    (0, test_1.expect)(event).toBeTruthy();
    (0, test_1.expect)(event?.eventType).toBe("google_review_distress");
    (0, test_1.expect)(event?.serviceLineCandidates).toContain("hvac");
    (0, test_1.expect)(event?.urgencyHint).toBeGreaterThanOrEqual(80);
    const classification = social_1.socialIntentConnector.classify(event);
    (0, test_1.expect)(classification.opportunityType).toBe("hvac_outage_distress");
});
(0, test_1.test)("distress connector compliance policy blocks ingestion when terms are not approved", () => {
    const policy = social_1.socialIntentConnector.compliancePolicy({
        tenantId: "tenant-1",
        sourceId: "source-social-3",
        sourceType: "social",
        config: {
            terms_status: "pending_review"
        }
    });
    (0, test_1.expect)(policy.ingestionAllowed).toBeFalsy();
    (0, test_1.expect)(policy.outboundAllowed).toBeFalsy();
    (0, test_1.expect)(policy.requiresLegalReview).toBeTruthy();
});
