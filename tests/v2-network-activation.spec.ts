import { expect, test } from "@playwright/test";
import {
  buildNetworkActivationOpportunitySeed,
  scoreNetworkActivationMatch,
  type NetworkOpportunity
} from "@/lib/v2/network-activation";

test("network activation derives a usable opportunity seed from v2 opportunity data", () => {
  const opportunity: NetworkOpportunity = {
    id: "opp_123",
    opportunityType: "restoration",
    serviceLine: "restoration",
    title: "Water mitigation opportunity",
    description: "Basement water intrusion",
    locationText: "245 Main St, Tampa, FL 33602",
    postalCode: "33602",
    contactStatus: "unknown",
    lifecycleStatus: "new",
    explainability: { signal_count: 2, source_types: ["weather.noaa"] }
  };

  const seed = buildNetworkActivationOpportunitySeed(opportunity);
  expect(seed.city).toBe("Tampa");
  expect(seed.state).toBe("FL");
  expect(seed.zip).toBe("33602");
  expect(seed.territory).toBe("Tampa, FL");
  expect(seed.category).toBe("restoration");
});

test("network activation prefers exact territory and postal matches", () => {
  const exactTerritory = scoreNetworkActivationMatch({
    territory: "Tampa, FL",
    city: "Tampa",
    state: "FL",
    postalCode: "33602",
    candidate: {
      territory: "Tampa, FL",
      city: "Tampa",
      state: "FL",
      postalCode: "33602",
      nearActiveIncident: false
    }
  });

  const exactPostal = scoreNetworkActivationMatch({
    territory: "Tampa, FL",
    city: "Tampa",
    state: "FL",
    postalCode: "33602",
    candidate: {
      territory: "Hillsborough County, FL",
      city: "Tampa",
      state: "FL",
      postalCode: "33602",
      nearActiveIncident: false
    }
  });

  expect(exactTerritory.reason).toBe("exact_territory");
  expect(exactTerritory.score).toBeGreaterThan(exactPostal.score);
  expect(exactPostal.reason).toBe("exact_postal");
});

test("network activation can still use same-state incident-ready contacts as a fallback", () => {
  const match = scoreNetworkActivationMatch({
    territory: "Tampa, FL",
    city: "Tampa",
    state: "FL",
    postalCode: "33602",
    candidate: {
      territory: "Orlando, FL",
      city: "Orlando",
      state: "FL",
      postalCode: "32801",
      nearActiveIncident: true
    }
  });

  expect(match.reason).toBe("same_state_incident_ready");
  expect(match.score).toBeGreaterThanOrEqual(70);
});

test("network activation rejects unmatched records without local or incident context", () => {
  const match = scoreNetworkActivationMatch({
    territory: "Tampa, FL",
    city: "Tampa",
    state: "FL",
    postalCode: "33602",
    candidate: {
      territory: "Atlanta, GA",
      city: "Atlanta",
      state: "GA",
      postalCode: "30303",
      nearActiveIncident: false
    }
  });

  expect(match.reason).toBe("unmatched");
  expect(match.score).toBe(0);
});
