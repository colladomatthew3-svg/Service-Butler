import { expect, test } from "@playwright/test";
import { sdrAgentInternals } from "../src/lib/v2/sdr-agent";

test("sdr agent blocks opportunities when source compliance is not approved", () => {
  const decision = sdrAgentInternals.verifyCandidate({
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

  expect(decision.qualified).toBeFalsy();
  expect(decision.reasons.some((reason) => reason.includes("blocked: compliance_status"))).toBeTruthy();
});

test("sdr agent qualifies high quality multi-signal opportunities", () => {
  const decision = sdrAgentInternals.verifyCandidate({
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
      source_type: "weather.noaa",
      source_provenance: "api.weather.gov",
      normalized_payload: {
        terms_status: "approved",
        data_freshness_score: 88
      }
    },
    minJobLikelihood: 60,
    minUrgency: 55,
    minSourceReliability: 50
  });

  expect(decision.qualified).toBeTruthy();
  expect(decision.score).toBeGreaterThanOrEqual(70);
  expect(decision.reasons.some((reason) => reason.includes("multi-signal"))).toBeTruthy();
  expect(decision.reasons.some((reason) => reason.includes("live provider proof"))).toBeTruthy();
});

test("sdr agent blocks synthetic source proof even when scores are high", () => {
  const decision = sdrAgentInternals.verifyCandidate({
    opportunity: {
      id: "opp-3",
      job_likelihood_score: 88,
      urgency_score: 82,
      source_reliability_score: 80,
      catastrophe_linkage_score: 64,
      location_text: "123 Main St, Tampa, FL 33602",
      postal_code: "33602",
      explainability_json: {
        signal_count: 2,
        confidence_score: 84
      }
    },
    sourceEvent: {
      compliance_status: "approved",
      source_provenance: "operator.synthetic.permits",
      normalized_payload: {
        terms_status: "approved",
        source_provenance: "operator.synthetic.permits",
        data_freshness_score: 91
      }
    },
    minJobLikelihood: 60,
    minUrgency: 55,
    minSourceReliability: 50
  });

  expect(decision.qualified).toBeFalsy();
  expect(decision.reasons.some((reason) => reason.includes("synthetic source proof"))).toBeTruthy();
});

test("sdr agent sms template and city/state parsing remain operator-readable", () => {
  const parsed = sdrAgentInternals.parseCityStatePostal("120 Main St, Albany, NY 12207");
  expect(parsed).toEqual({
    city: "Albany",
    state: "NY",
    postalCode: "12207"
  });

  const message = sdrAgentInternals.buildSdrSmsMessage({
    serviceLine: "plumbing",
    title: "Freeze pipe risk",
    city: "Albany",
    state: "NY"
  });

  expect(message).toContain("plumbing");
  expect(message).toContain("Albany, NY");
});
