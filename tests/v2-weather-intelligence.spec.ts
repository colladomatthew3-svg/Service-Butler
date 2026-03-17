import { expect, test } from "@playwright/test";
import { weatherConnector } from "../src/lib/v2/connectors/weather";

test("weather intelligence normalizes storm/hail/freeze/flood categories with service-line mapping", async () => {
  const input = {
    tenantId: "tenant-1",
    sourceId: "source-weather-1",
    sourceType: "weather",
    config: {
      latitude: 40.7128,
      longitude: -74.006,
      city: "New York",
      state: "NY",
      postal_code: "10001",
      source_name: "NOAA"
    }
  };

  const events = await weatherConnector.normalize(
    [
      {
        id: "hail-1",
        properties: {
          event: "Severe Thunderstorm Warning",
          headline: "Hail and wind in area",
          severity: "Severe",
          urgency: "Immediate",
          sent: "2026-03-16T10:00:00.000Z",
          areaDesc: "Manhattan, NY"
        }
      },
      {
        id: "freeze-1",
        properties: {
          event: "Freeze Warning",
          headline: "Freeze conditions expected",
          severity: "Moderate",
          urgency: "Expected",
          sent: "2026-03-16T11:00:00.000Z",
          areaDesc: "Queens, NY"
        }
      },
      {
        id: "flood-1",
        properties: {
          event: "Flood Warning",
          headline: "Flood waters rising",
          severity: "Extreme",
          urgency: "Immediate",
          sent: "2026-03-16T12:00:00.000Z",
          areaDesc: "Brooklyn, NY"
        }
      }
    ],
    input
  );

  expect(events).toHaveLength(3);

  const [storm, freeze, flood] = events;
  expect(storm?.eventCategory).toBe("storm");
  expect(storm?.serviceLineCandidates).toContain("roofing");
  expect(storm?.serviceLineCandidates).toContain("restoration");
  expect(storm?.normalizedPayload.connector_version).toBeTruthy();

  expect(freeze?.eventCategory).toBe("freeze");
  expect(freeze?.serviceLineCandidates).toContain("plumbing");
  expect(freeze?.serviceLineCandidates).toContain("hvac");
  expect(freeze?.likelyJobType).toBe("emergency plumbing");

  expect(flood?.eventCategory).toBe("flood");
  expect(flood?.serviceLineCandidates).toContain("restoration");
  expect(flood?.serviceLineCandidates).toContain("plumbing");
  expect(flood?.urgencyHint).toBeGreaterThanOrEqual(80);
});

test("weather intelligence classification maps severe categories to expected opportunity types", async () => {
  const [hailEvent] = await weatherConnector.normalize(
    [
      {
        id: "hail-2",
        properties: {
          event: "Hail Warning",
          headline: "Large hail expected",
          severity: "Severe",
          urgency: "Immediate",
          sent: "2026-03-16T13:00:00.000Z",
          areaDesc: "Bronx, NY"
        }
      }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-weather-2",
      sourceType: "weather",
      config: {}
    }
  );

  expect(hailEvent).toBeTruthy();
  const classification = weatherConnector.classify(hailEvent!);
  expect(classification.opportunityType).toBe("roof_damage_risk");
  expect(classification.serviceLine).toBe("roofing");
});
