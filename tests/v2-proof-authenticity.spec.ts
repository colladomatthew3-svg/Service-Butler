import { expect, test } from "@playwright/test";
import { classifyProofAuthenticity, isProofAuthentic } from "../src/lib/v2/proof-authenticity";

test("proof authenticity recognizes live provider provenance", () => {
  const authenticity = classifyProofAuthenticity({
    sourceType: "weather.noaa",
    sourceName: "NOAA Weather Alerts",
    sourceProvenance: "api.weather.gov"
  });

  expect(authenticity).toBe("live_provider");
  expect(isProofAuthentic(authenticity)).toBeTruthy();
});

test("proof authenticity recognizes live derived forecast signals", () => {
  const authenticity = classifyProofAuthenticity({
    sourceType: "scanner_signal",
    sourceProvenance: "OPEN_METEO_CLUSTER"
  });

  expect(authenticity).toBe("live_derived");
});

test("proof authenticity blocks synthetic sources", () => {
  const authenticity = classifyProofAuthenticity({
    sourceType: "permits",
    sourceProvenance: "operator.synthetic.permits"
  });

  expect(authenticity).toBe("synthetic");
  expect(isProofAuthentic(authenticity)).toBeFalsy();
});

test("proof authenticity does not over-credit ambiguous public web pages", () => {
  const authenticity = classifyProofAuthenticity({
    sourceType: "incident",
    sourceProvenance: "https://county.example.gov/incidents/flood-response"
  });

  expect(authenticity).toBe("unknown");
  expect(isProofAuthentic(authenticity)).toBeFalsy();
});

test("public incident pages do not auto-promote to live provider", () => {
  const authenticity = classifyProofAuthenticity({
    sourceType: "incident",
    sourceProvenance: "https://county.example.gov/incidents/flood-response"
  });

  expect(authenticity).not.toBe("live_provider");
});

test("legacy scanner signal does not auto-promote without stronger evidence", () => {
  const authenticity = classifyProofAuthenticity({
    sourceType: "scanner_signal",
    normalizedPayload: {
      connector_key: "scanner_signal"
    }
  });

  expect(authenticity).toBe("unknown");
});

test("connector input mode live_provider still wins", () => {
  const authenticity = classifyProofAuthenticity({
    sourceType: "incident",
    sourceProvenance: "https://county.example.gov/incidents/flood-response",
    connectorRunMetadata: {
      connector_input_mode: "live_provider"
    }
  });

  expect(authenticity).toBe("live_provider");
});

test("friendly source name alone does not promote live provider", () => {
  const authenticity = classifyProofAuthenticity({
    sourceType: "weather",
    sourceName: "NOAA Weather Feed"
  });

  expect(authenticity).not.toBe("live_provider");
});
