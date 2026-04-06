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

test("score merge does not inflate signal count for repeated source type", () => {
  const incoming = computeOpportunityScores({
    sourceType: "incidents.generic",
    eventRecencyMinutes: 12,
    severity: 80,
    geographyMatch: 84,
    geographyPrecision: 84,
    propertyTypeFit: 60,
    serviceLineFit: 84,
    priorCustomerMatch: 30,
    contactAvailability: 50,
    supportingSignalsCount: 2,
    catastropheSignal: 74,
    sourceReliability: 72,
    signalAgreement: 80
  });

  const merged = connectorRunnerInternals.mergeOpportunityScores({
    existing: {
      urgency_score: 76,
      job_likelihood_score: 70,
      source_reliability_score: 75,
      catastrophe_linkage_score: 68,
      explainability_json: {
        signal_count: 1,
        confidence_score: 72,
        source_types: ["incidents.generic"]
      }
    },
    incoming,
    incomingConfidence: incoming.confidenceScore,
    sourceType: "incidents.generic"
  });

  expect(merged.signalCount).toBe(1);
  expect(merged.sourceTypes).toEqual(["incidents.generic"]);
});

test("runner score inputs carry incident timestamp and freshness context", () => {
  const input = connectorRunnerInternals.scoreInputsForEvent(
    {
      occurredAt: "2026-03-20T12:00:00.000Z",
      dedupeKey: "incident-1",
      eventType: "incidents.generic",
      eventCategory: "water_incident",
      title: "Water incident",
      locationText: "Somewhere in NY",
      serviceLine: "restoration",
      supportingSignalsCount: 1,
      sourceReliability: 40,
      normalizedPayload: {
        timestamp_confidence: "inferred",
        data_freshness_score: 24
      },
      rawPayload: {}
    },
    50,
    {
      incidentFamily: true
    }
  );

  expect(input.timestampConfidence).toBe(52);
  expect(input.freshnessScore).toBe(24);
  expect(input.falsePositiveRisk).toBeGreaterThanOrEqual(40);
  expect(input.geographyPrecision).toBeLessThan(40);
});

test("weak inferred incident signals produce lower confidence than sourced signals", () => {
  const sourced = computeOpportunityScores({
    sourceType: "incidents.generic",
    eventRecencyMinutes: 20,
    severity: 74,
    geographyMatch: 78,
    geographyPrecision: 80,
    propertyTypeFit: 60,
    serviceLineFit: 76,
    priorCustomerMatch: 24,
    contactAvailability: 48,
    supportingSignalsCount: 2,
    catastropheSignal: 68,
    sourceReliability: 76,
    signalAgreement: 78
  });

  const inferredWeak = computeOpportunityScores({
    sourceType: "incidents.generic",
    eventRecencyMinutes: 20,
    severity: 74,
    geographyMatch: 78,
    geographyPrecision: 40,
    propertyTypeFit: 60,
    serviceLineFit: 76,
    priorCustomerMatch: 24,
    contactAvailability: 48,
    supportingSignalsCount: 1,
    catastropheSignal: 68,
    sourceReliability: 42,
    signalAgreement: 38
  });

  expect(inferredWeak.confidenceScore).toBeLessThan(sourced.confidenceScore);
  expect(inferredWeak.explainability.signal_agreement).toBe(38);
});

test("score merge does not increase signal count when incoming source type already exists", () => {
  const incoming = computeOpportunityScores({
    sourceType: "incidents.generic",
    eventRecencyMinutes: 12,
    severity: 80,
    geographyMatch: 84,
    geographyPrecision: 84,
    propertyTypeFit: 60,
    serviceLineFit: 84,
    priorCustomerMatch: 30,
    contactAvailability: 50,
    supportingSignalsCount: 2,
    catastropheSignal: 74,
    sourceReliability: 72,
    signalAgreement: 80
  });

  const merged = connectorRunnerInternals.mergeOpportunityScores({
    existing: {
      urgency_score: 76,
      job_likelihood_score: 70,
      source_reliability_score: 75,
      catastrophe_linkage_score: 68,
      explainability_json: {
        signal_count: 1,
        confidence_score: 72,
        source_types: ["incidents.generic"]
      }
    },
    incoming,
    incomingConfidence: incoming.confidenceScore,
    sourceType: "incidents.generic"
  });

  expect(merged.sourceTypes.filter((value) => value === "incidents.generic")).toHaveLength(1);
  expect(merged.signalCount).toBe(1);
  expect(merged.multiSignal).toBeFalsy();
});
