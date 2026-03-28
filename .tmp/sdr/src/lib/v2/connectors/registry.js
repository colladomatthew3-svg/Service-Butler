"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnectorByKey = getConnectorByKey;
exports.listConnectors = listConnectors;
const weather_1 = require("@/lib/v2/connectors/weather");
const permits_1 = require("@/lib/v2/connectors/permits");
const social_1 = require("@/lib/v2/connectors/social");
const incidents_1 = require("@/lib/v2/connectors/incidents");
const usgs_water_1 = require("@/lib/v2/connectors/usgs-water");
const open311_1 = require("@/lib/v2/connectors/open311");
const openfema_1 = require("@/lib/v2/connectors/openfema");
const census_1 = require("@/lib/v2/connectors/census");
const overpass_1 = require("@/lib/v2/connectors/overpass");
const CONNECTORS = {
    [weather_1.weatherConnector.key]: weather_1.weatherConnector,
    [permits_1.permitsConnector.key]: permits_1.permitsConnector,
    [social_1.socialIntentConnector.key]: social_1.socialIntentConnector,
    [incidents_1.incidentConnector.key]: incidents_1.incidentConnector,
    [usgs_water_1.usgsWaterConnector.key]: usgs_water_1.usgsWaterConnector,
    [open311_1.open311Connector.key]: open311_1.open311Connector,
    [openfema_1.openFemaConnector.key]: openfema_1.openFemaConnector,
    [census_1.censusConnector.key]: census_1.censusConnector,
    [overpass_1.overpassConnector.key]: overpass_1.overpassConnector
};
function getConnectorByKey(key) {
    return CONNECTORS[key] || null;
}
function listConnectors() {
    return Object.values(CONNECTORS);
}
