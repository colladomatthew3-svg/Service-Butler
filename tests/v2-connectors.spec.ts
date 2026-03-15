import { expect, test } from "@playwright/test";
import { weatherConnector } from "../src/lib/v2/connectors/weather";
import { incidentConnector } from "../src/lib/v2/connectors/incidents";

test("weather connector normalizes and classifies NOAA-like records", async () => {
  const events = await weatherConnector.normalize([
    {
      id: "abc-1",
      properties: {
        event: "Flood Warning",
        headline: "Flood Warning for county",
        description: "Rising water expected",
        severity: "Severe",
        urgency: "Immediate",
        sent: "2026-03-14T05:00:00.000Z",
        areaDesc: "Suffolk County, NY"
      }
    }
  ], {
    tenantId: "tenant-1",
    sourceId: "source-1",
    sourceType: "weather",
    config: {}
  });

  expect(events).toHaveLength(1);
  const classification = weatherConnector.classify(events[0]!);
  expect(classification.serviceLine).toBe("restoration");
  expect(classification.opportunityType).toContain("storm");
});

test("incident connector is compliance-gated by default", () => {
  const policy = incidentConnector.compliancePolicy({
    tenantId: "tenant-1",
    sourceId: "source-1",
    sourceType: "incident",
    config: {}
  });

  expect(policy.requiresLegalReview).toBeTruthy();
  expect(policy.outboundAllowed).toBeFalsy();
});
