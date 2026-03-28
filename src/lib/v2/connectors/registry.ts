import type { ConnectorAdapter } from "@/lib/v2/connectors/types";
import { weatherConnector } from "@/lib/v2/connectors/weather";
import { permitsConnector } from "@/lib/v2/connectors/permits";
import { socialIntentConnector } from "@/lib/v2/connectors/social";
import { incidentConnector } from "@/lib/v2/connectors/incidents";
import { usgsWaterConnector } from "@/lib/v2/connectors/usgs-water";
import { open311Connector } from "@/lib/v2/connectors/open311";
import { openFemaConnector } from "@/lib/v2/connectors/openfema";
import { censusConnector } from "@/lib/v2/connectors/census";
import { overpassConnector } from "@/lib/v2/connectors/overpass";

const CONNECTORS: Record<string, ConnectorAdapter> = {
  [weatherConnector.key]: weatherConnector,
  [permitsConnector.key]: permitsConnector,
  [socialIntentConnector.key]: socialIntentConnector,
  [incidentConnector.key]: incidentConnector,
  [usgsWaterConnector.key]: usgsWaterConnector,
  [open311Connector.key]: open311Connector,
  [openFemaConnector.key]: openFemaConnector,
  [censusConnector.key]: censusConnector,
  [overpassConnector.key]: overpassConnector
};

export function getConnectorByKey(key: string) {
  return CONNECTORS[key] || null;
}

export function listConnectors() {
  return Object.values(CONNECTORS);
}
