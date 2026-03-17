import { expect, test } from "@playwright/test";
import { socialIntentConnector } from "../src/lib/v2/connectors/social";

test("distress connector classifies reddit flood distress into water mitigation opportunity", async () => {
  const [event] = await socialIntentConnector.normalize(
    [
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
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-social-1",
      sourceType: "social",
      config: {
        terms_status: "approved",
        source_name: "Reddit"
      }
    }
  );

  expect(event).toBeTruthy();
  expect(event?.eventType).toBe("reddit_distress_post");
  expect(event?.serviceLineCandidates).toContain("restoration");
  expect(event?.serviceLineCandidates).toContain("plumbing");
  expect(event?.likelyJobType).toBe("water mitigation");
  expect(event?.distressContextSummary).toContain("flooded basement");

  const classification = socialIntentConnector.classify(event!);
  expect(classification.opportunityType).toBe("water_damage_distress");
  expect(classification.serviceLine).toBe("restoration");
});

test("distress connector classifies google review no-heat issues into HVAC urgency", async () => {
  const [event] = await socialIntentConnector.normalize(
    [
      {
        id: "review-1",
        platform: "google_review",
        title: "No heat in house",
        review_text: "No heat for two days and pipes may freeze",
        created_at: "2026-03-16T14:00:00.000Z",
        city: "Syracuse",
        state: "NY"
      }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-social-2",
      sourceType: "social",
      config: {
        terms_status: "approved",
        source_name: "Google Reviews"
      }
    }
  );

  expect(event).toBeTruthy();
  expect(event?.eventType).toBe("google_review_distress");
  expect(event?.serviceLineCandidates).toContain("hvac");
  expect(event?.urgencyHint).toBeGreaterThanOrEqual(80);

  const classification = socialIntentConnector.classify(event!);
  expect(classification.opportunityType).toBe("hvac_outage_distress");
});

test("distress connector compliance policy blocks ingestion when terms are not approved", () => {
  const policy = socialIntentConnector.compliancePolicy({
    tenantId: "tenant-1",
    sourceId: "source-social-3",
    sourceType: "social",
    config: {
      terms_status: "pending_review"
    }
  });

  expect(policy.ingestionAllowed).toBeFalsy();
  expect(policy.outboundAllowed).toBeFalsy();
  expect(policy.requiresLegalReview).toBeTruthy();
});
