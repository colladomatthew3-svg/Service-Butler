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

  expect(
    classifySourceLane({
      sourceTypes: ["incident"],
      summary: "Sewage backup and mold contamination after basement overflow"
    })
  ).toBe("mold_biohazard");
});

test("source lane taxonomy remains stable across tier1 connector families", () => {
  const matrix: Array<{ lane: string; input: Parameters<typeof classifySourceLane>[0] }> = [
    { lane: "311", input: { sourceTypes: ["open311.generic"], summary: "Municipal service request" } },
    { lane: "flood", input: { sourceTypes: ["openfema"], summary: "Flood declaration in county" } },
    { lane: "fire", input: { sourceTypes: ["incidents.generic"], summary: "Structure fire response and smoke damage" } },
    { lane: "outage", input: { sourceType: "incidents.generic", summary: "Utility outage after transformer failure" } },
    { lane: "weather", input: { sourceTypes: ["weather.noaa"], summary: "Severe storm and wind warning" } },
    { lane: "mold_biohazard", input: { sourceTypes: ["incident"], summary: "Sewage contamination and mold growth" } },
    { lane: "permits", input: { sourceTypes: ["permits.generic"], summary: "Permit filed for restoration" } },
    { lane: "property", input: { sourceTypes: ["overpass"], summary: "Property parcel and census context" } },
    { lane: "social", input: { sourceTypes: ["social.intent.public"], summary: "Distress post from local resident" } },
    { lane: "other", input: { sourceTypes: ["unknown.signal"], summary: "General demand context" } }
  ];

  for (const row of matrix) {
    expect(classifySourceLane(row.input)).toBe(row.lane);
  }
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
