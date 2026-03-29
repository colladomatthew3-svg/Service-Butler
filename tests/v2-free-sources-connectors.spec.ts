import { expect, test } from "@playwright/test";
import { usgsWaterConnector } from "../src/lib/v2/connectors/usgs-water";
import { open311Connector } from "../src/lib/v2/connectors/open311";
import { openFemaConnector } from "../src/lib/v2/connectors/openfema";
import { censusConnector } from "../src/lib/v2/connectors/census";
import { overpassConnector } from "../src/lib/v2/connectors/overpass";
import { listConnectors } from "../src/lib/v2/connectors/registry";
import { inferConnectorKey } from "../src/lib/v2/connectors/source-type-map";

test("registry includes all free-source connector keys", () => {
  const keys = listConnectors().map((connector) => connector.key);
  expect(keys).toContain("social.intent.public");
  expect(keys).toContain("water.usgs");
  expect(keys).toContain("open311.generic");
  expect(keys).toContain("disaster.openfema");
  expect(keys).toContain("enrichment.census");
  expect(keys).toContain("property.overpass");
});

test("source-type inference resolves social signals to the public distress connector", () => {
  expect(inferConnectorKey("social")).toBe("social.intent.public");
  expect(inferConnectorKey("reddit_distress")).toBe("social.intent.public");
});

test("USGS water connector creates flood intelligence events", async () => {
  const [event] = await usgsWaterConnector.normalize(
    [
      {
        site_name: "Hudson River",
        site_code: "01358000",
        value: 18000,
        observed_at: "2026-03-17T12:00:00.000Z",
        city: "Albany",
        state: "NY"
      }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-usgs",
      sourceType: "usgs_water",
      config: { terms_status: "approved" }
    }
  );

  expect(event).toBeTruthy();
  expect(event?.eventCategory).toBe("flood_indicator");
  expect(event?.serviceLineCandidates).toContain("restoration");
  expect(event?.serviceLineCandidates).toContain("plumbing");
  expect(usgsWaterConnector.classify(event!)).toEqual({
    opportunityType: "flood_risk_signal",
    serviceLine: "restoration"
  });
});

test("Open311 connector classifies water-leak style service requests", async () => {
  const [event] = await open311Connector.normalize(
    [
      {
        service_request_id: "311-1",
        service_name: "Water Leak",
        description: "Basement flooding and leak from ceiling",
        requested_datetime: "2026-03-17T10:00:00.000Z",
        address: "10 Main St",
        city: "Rochester",
        state: "NY",
        zip: "14604",
        lat: 43.1566,
        long: -77.6088
      }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-open311",
      sourceType: "open311",
      config: { terms_status: "approved" }
    }
  );

  expect(event?.eventCategory).toBe("water_incident");
  expect(event?.likelyJobType).toBe("water mitigation");
  expect(open311Connector.classify(event!).opportunityType).toBe("flood_incident");
});

test("OpenFEMA connector maps disaster declarations to catastrophe opportunities", async () => {
  const [event] = await openFemaConnector.normalize(
    [
      {
        disasterNumber: 9999,
        incidentType: "Hurricane",
        declarationDate: "2026-03-16T05:00:00.000Z",
        designatedArea: "Suffolk County",
        state: "NY"
      }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-openfema",
      sourceType: "openfema",
      config: { terms_status: "approved" }
    }
  );

  expect(event?.eventCategory).toBe("storm_incident");
  expect(event?.catastropheSignal).toBeGreaterThanOrEqual(80);
  expect(openFemaConnector.classify(event!).opportunityType).toBe("catastrophe_signal");
});

test("Census connector emits market-risk enrichment signals", async () => {
  const [event] = await censusConnector.normalize(
    [
      {
        geoid: "36061",
        area_name: "New York County",
        older_housing_ratio: 78,
        renter_rate: 82,
        vacancy_rate: 9,
        severe_weather_exposure: 70,
        observed_at: "2026-03-17T00:00:00.000Z"
      }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-census",
      sourceType: "census",
      config: { terms_status: "approved" }
    }
  );

  expect(event?.eventCategory).toBe("market_risk_enrichment");
  expect(event?.serviceLineCandidates).toContain("restoration");
  expect(event?.normalizedPayload.risk_score).toBeGreaterThanOrEqual(60);
  expect(censusConnector.classify(event!).opportunityType).toBe("market_risk_signal");
});

test("Overpass connector normalizes commercial property signals", async () => {
  const [event] = await overpassConnector.normalize(
    [
      {
        id: 1234,
        type: "node",
        lat: 40.7128,
        lon: -74.006,
        tags: {
          name: "Downtown Hotel",
          amenity: "hotel",
          "addr:city": "New York",
          "addr:state": "NY",
          "addr:postcode": "10001"
        }
      }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-overpass",
      sourceType: "overpass",
      config: { terms_status: "approved" }
    }
  );

  expect(event?.eventCategory).toBe("commercial_property_signal");
  expect(event?.serviceLineCandidates).toContain("commercial");
  expect(overpassConnector.classify(event!)).toEqual({
    opportunityType: "commercial_property_signal",
    serviceLine: "commercial"
  });
});
