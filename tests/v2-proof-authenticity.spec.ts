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
