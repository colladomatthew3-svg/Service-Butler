import { expect, test } from "@playwright/test";
import { deriveOpportunityActionability } from "../src/lib/v2/opportunity-actionability";

test("actionability exposes route-ready controls for non-gated incident opportunities", () => {
  const actionability = deriveOpportunityActionability({
    lifecycleStatus: "new",
    routingStatus: "pending",
    contactStatus: "identified",
    explainability: {
      qualification_status: "qualified_contactable",
      verification_status: "verified",
      phone: "+17165551212",
      confidence_score: 84,
      freshness_score: 90,
      recommended_next_action: "dispatch_now",
      territory_relevance: "high",
      review_required: false
    },
    assignment: null
  });

  expect(actionability.canRouteNow).toBeTruthy();
  expect(actionability.canConvertToJob).toBeTruthy();
  expect(actionability.reviewRequired).toBeFalsy();
});

test("review-required opportunities are gated from route and convert actions", () => {
  const actionability = deriveOpportunityActionability({
    lifecycleStatus: "new",
    routingStatus: "pending",
    contactStatus: "unknown",
    explainability: {
      qualification_status: "queued_for_sdr",
      review_required: true,
      recommended_next_action: "verify_location_then_route"
    },
    assignment: null
  });

  expect(actionability.reviewRequired).toBeTruthy();
  expect(actionability.canRouteNow).toBeFalsy();
  expect(actionability.canConvertToJob).toBeFalsy();
});

test("assignment controls map to pending assignment lifecycle", () => {
  const actionability = deriveOpportunityActionability({
    lifecycleStatus: "assigned",
    routingStatus: "routed",
    contactStatus: "identified",
    explainability: {
      qualification_status: "qualified_contactable",
      verification_status: "verified",
      phone: "+17165551212",
      review_required: false
    },
    assignment: {
      id: "assignment-1",
      status: "pending_acceptance",
      assigned_tenant_id: "tenant-1",
      sla_due_at: "2026-04-07T12:00:00.000Z",
      assignment_reason: "territory_match"
    }
  });

  expect(actionability.assignmentId).toBe("assignment-1");
  expect(actionability.canAcceptAssignment).toBeTruthy();
  expect(actionability.canEscalateAssignment).toBeTruthy();
  expect(actionability.canRouteNow).toBeFalsy();
});

test("actionability preserves qualification-derived next action when incident override is absent", () => {
  const actionability = deriveOpportunityActionability({
    lifecycleStatus: "new",
    routingStatus: "pending",
    contactStatus: "unknown",
    explainability: {
      qualification_status: "queued_for_sdr"
    },
    assignment: null
  });

  expect(actionability.recommendedNextAction).toBe("await_sdr_review");
  expect(actionability.reviewRequired).toBeTruthy();
});
