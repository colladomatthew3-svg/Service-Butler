import { expect, test } from "@playwright/test";
import { classifySourceLane, opportunityPriorityScore } from "@/lib/v2/source-lanes";

test("source lane classification keeps municipal and outage signals stable", () => {
  expect(
    classifySourceLane({
      sourceTypes: ["open311.generic"],
      sourceProvenance: "data.cityofnewyork.us",
      summary: "Municipal flooding complaint"
    })
  ).toBe("311");

  expect(
    classifySourceLane({
      sourceType: "incidents.generic",
      summary: "Widespread utility outage after transformer fire"
    })
  ).toBe("outage");
});

test("opportunity priority weights urgency, job likelihood, and reliability together", () => {
  const urgentButWeak = opportunityPriorityScore({
    urgencyScore: 92,
    jobLikelihoodScore: 38,
    sourceReliabilityScore: 42
  });
  const balancedHighConfidence = opportunityPriorityScore({
    urgencyScore: 78,
    jobLikelihoodScore: 83,
    sourceReliabilityScore: 88
  });

  expect(balancedHighConfidence).toBeGreaterThan(urgentButWeak);
  expect(opportunityPriorityScore({ urgencyScore: 80, jobLikelihoodScore: 80, sourceReliabilityScore: 80 })).toBe(80);
});
