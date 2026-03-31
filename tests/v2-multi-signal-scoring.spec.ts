import { expect, test } from "@playwright/test";
import { computeOpportunityScores } from "../src/lib/v2/scoring";
import { connectorRunnerInternals } from "../src/lib/v2/connectors/runner";
import { getVertical } from "../src/lib/v2/franchise-verticals";

test("multi-signal scoring increases confidence with stronger source agreement", () => {
  const lowAgreement = computeOpportunityScores({
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

  const highAgreement = computeOpportunityScores({
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

  expect(highAgreement.confidenceScore).toBeGreaterThan(lowAgreement.confidenceScore);
  expect(highAgreement.explainability.signal_agreement).toBe(90);
});

test("score merge marks opportunities as multi-signal when distinct sources agree", () => {
  const incoming = computeOpportunityScores({
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

  const merged = connectorRunnerInternals.mergeOpportunityScores({
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

  expect(merged.signalCount).toBe(2);
  expect(merged.sourceTypes).toContain("weather_freeze_alert");
  expect(merged.sourceTypes).toContain("google_review_distress");
  expect(merged.multiSignal).toBeTruthy();
  expect(merged.confidenceScore).toBeGreaterThanOrEqual(70);
});

test("runner score inputs carry vertical scoring context into the live ingestion path", () => {
  const vertical = getVertical("restoration");
  const input = connectorRunnerInternals.scoreInputsForEvent(
    {
      occurredAt: "2026-03-20T12:00:00.000Z",
      dedupeKey: "storm-1",
      eventType: "weather.nws",
      eventCategory: "storm",
      title: "Storm warning",
      serviceLine: "restoration",
      rawPayload: {},
      normalizedPayload: {}
    },
    55,
    {
      vertical,
      signalCategory: "storm"
    }
  );

  expect(input.vertical?.key).toBe("restoration");
  expect(input.signalCategory).toBe("storm");
});

test("runner builds address-level dedup input from normalized connector events", () => {
  const dedupInput = connectorRunnerInternals.buildDedupInputForEvent(
    {
      occurredAt: "2026-03-20T12:00:00.000Z",
      dedupeKey: "permit-1",
      eventType: "permit.city",
      title: "Roof permit",
      addressText: "123 Main St",
      city: "Albany",
      state: "NY",
      postalCode: "12207",
      rawPayload: {},
      normalizedPayload: {}
    },
    "roofing"
  );

  expect(dedupInput).toEqual({
    address: "123 Main St",
    city: "Albany",
    state: "NY",
    postalCode: "12207",
    serviceType: "roofing",
    sourceType: "permit.city"
  });
});
