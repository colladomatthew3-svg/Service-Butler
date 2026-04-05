import { expect, test } from "@playwright/test";
import { deriveOpportunityPipelineStage } from "@/lib/v2/opportunity-pipeline";

test("defaults to raw when no pipeline metadata exists", () => {
  const stage = deriveOpportunityPipelineStage({});
  expect(stage).toBe("raw");
});

test("maps source-linked records to normalized when only source context is present", () => {
  const stage = deriveOpportunityPipelineStage({
    sourceEventId: "source-event-1",
    explainability: {
      source_type: "open311"
    }
  });

  expect(stage).toBe("normalized");
});

test("maps scored records before review/routing to scored", () => {
  const stage = deriveOpportunityPipelineStage({
    opportunityType: "incident",
    serviceLine: "water",
    urgencyScore: 81,
    jobLikelihoodScore: 74,
    sourceReliabilityScore: 69
  });

  expect(stage).toBe("scored");
});

test("maps review-gated records to queued_for_review", () => {
  const stage = deriveOpportunityPipelineStage({
    lifecycleStatus: "new",
    explainability: {
      next_recommended_action: "await_sdr_review"
    }
  });

  expect(stage).toBe("queued_for_review");
});

test("maps qualified records to approved and contacted records to contacted", () => {
  const approved = deriveOpportunityPipelineStage({
    lifecycleStatus: "qualified",
    contactStatus: "identified"
  });
  const contacted = deriveOpportunityPipelineStage({
    lifecycleStatus: "contacted",
    contactStatus: "contacted"
  });

  expect(approved).toBe("approved");
  expect(contacted).toBe("contacted");
});

test("maps terminal outcomes to converted_to_job, archived, and rejected", () => {
  const converted = deriveOpportunityPipelineStage({ lifecycleStatus: "booked_job" });
  const archived = deriveOpportunityPipelineStage({ lifecycleStatus: "closed_lost" });
  const rejected = deriveOpportunityPipelineStage({
    lifecycleStatus: "new",
    contactStatus: "do_not_contact"
  });

  expect(converted).toBe("converted_to_job");
  expect(archived).toBe("archived");
  expect(rejected).toBe("rejected");
});
