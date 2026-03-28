"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const usgs_water_1 = require("../src/lib/v2/connectors/usgs-water");
const open311_1 = require("../src/lib/v2/connectors/open311");
const openfema_1 = require("../src/lib/v2/connectors/openfema");
const census_1 = require("../src/lib/v2/connectors/census");
const overpass_1 = require("../src/lib/v2/connectors/overpass");
const registry_1 = require("../src/lib/v2/connectors/registry");
(0, test_1.test)("registry includes all free-source connector keys", () => {
    const keys = (0, registry_1.listConnectors)().map((connector) => connector.key);
    (0, test_1.expect)(keys).toContain("water.usgs");
    (0, test_1.expect)(keys).toContain("open311.generic");
    (0, test_1.expect)(keys).toContain("disaster.openfema");
    (0, test_1.expect)(keys).toContain("enrichment.census");
    (0, test_1.expect)(keys).toContain("property.overpass");
});
(0, test_1.test)("USGS water connector creates flood intelligence events", async () => {
    const [event] = await usgs_water_1.usgsWaterConnector.normalize([
        {
            site_name: "Hudson River",
            site_code: "01358000",
            value: 18000,
            observed_at: "2026-03-17T12:00:00.000Z",
            city: "Albany",
            state: "NY"
        }
    ], {
        tenantId: "tenant-1",
        sourceId: "source-usgs",
        sourceType: "usgs_water",
        config: { terms_status: "approved" }
    });
    (0, test_1.expect)(event).toBeTruthy();
    (0, test_1.expect)(event?.eventCategory).toBe("flood_indicator");
    (0, test_1.expect)(event?.serviceLineCandidates).toContain("restoration");
    (0, test_1.expect)(event?.serviceLineCandidates).toContain("plumbing");
    (0, test_1.expect)(usgs_water_1.usgsWaterConnector.classify(event)).toEqual({
        opportunityType: "flood_risk_signal",
        serviceLine: "restoration"
    });
});
(0, test_1.test)("Open311 connector classifies water-leak style service requests", async () => {
    const [event] = await open311_1.open311Connector.normalize([
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
    ], {
        tenantId: "tenant-1",
        sourceId: "source-open311",
        sourceType: "open311",
        config: { terms_status: "approved" }
    });
    (0, test_1.expect)(event?.eventCategory).toBe("water_incident");
    (0, test_1.expect)(event?.likelyJobType).toBe("water mitigation");
    (0, test_1.expect)(open311_1.open311Connector.classify(event).opportunityType).toBe("flood_incident");
});
(0, test_1.test)("OpenFEMA connector maps disaster declarations to catastrophe opportunities", async () => {
    const [event] = await openfema_1.openFemaConnector.normalize([
        {
            disasterNumber: 9999,
            incidentType: "Hurricane",
            declarationDate: "2026-03-16T05:00:00.000Z",
            designatedArea: "Suffolk County",
            state: "NY"
        }
    ], {
        tenantId: "tenant-1",
        sourceId: "source-openfema",
        sourceType: "openfema",
        config: { terms_status: "approved" }
    });
    (0, test_1.expect)(event?.eventCategory).toBe("storm_incident");
    (0, test_1.expect)(event?.catastropheSignal).toBeGreaterThanOrEqual(80);
    (0, test_1.expect)(openfema_1.openFemaConnector.classify(event).opportunityType).toBe("catastrophe_signal");
});
(0, test_1.test)("Census connector emits market-risk enrichment signals", async () => {
    const [event] = await census_1.censusConnector.normalize([
        {
            geoid: "36061",
            area_name: "New York County",
            older_housing_ratio: 78,
            renter_rate: 82,
            vacancy_rate: 9,
            severe_weather_exposure: 70,
            observed_at: "2026-03-17T00:00:00.000Z"
        }
    ], {
        tenantId: "tenant-1",
        sourceId: "source-census",
        sourceType: "census",
        config: { terms_status: "approved" }
    });
    (0, test_1.expect)(event?.eventCategory).toBe("market_risk_enrichment");
    (0, test_1.expect)(event?.serviceLineCandidates).toContain("restoration");
    (0, test_1.expect)(event?.normalizedPayload.risk_score).toBeGreaterThanOrEqual(60);
    (0, test_1.expect)(census_1.censusConnector.classify(event).opportunityType).toBe("market_risk_signal");
});
(0, test_1.test)("Overpass connector normalizes commercial property signals", async () => {
    const [event] = await overpass_1.overpassConnector.normalize([
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
    ], {
        tenantId: "tenant-1",
        sourceId: "source-overpass",
        sourceType: "overpass",
        config: { terms_status: "approved" }
    });
    (0, test_1.expect)(event?.eventCategory).toBe("commercial_property_signal");
    (0, test_1.expect)(event?.serviceLineCandidates).toContain("commercial");
    (0, test_1.expect)(overpass_1.overpassConnector.classify(event)).toEqual({
        opportunityType: "commercial_property_signal",
        serviceLine: "commercial"
    });
});
