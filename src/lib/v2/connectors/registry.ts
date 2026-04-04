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
import { utilityOutageConnector } from "@/lib/v2/connectors/utility";

const CONNECTORS: Record<string, ConnectorAdapter> = {
  [weatherConnector.key]: weatherConnector,
  [permitsConnector.key]: permitsConnector,
  [socialIntentConnector.key]: socialIntentConnector,
  [incidentConnector.key]: incidentConnector,
  [usgsWaterConnector.key]: usgsWaterConnector,
  [open311Connector.key]: open311Connector,
  [openFemaConnector.key]: openFemaConnector,
  [censusConnector.key]: censusConnector,
  [overpassConnector.key]: overpassConnector,
  [utilityOutageConnector.key]: utilityOutageConnector
};

const CONNECTOR_ALIASES: Record<string, string> = {
  "permits.placeholder": permitsConnector.key,
  "social.intent.placeholder": socialIntentConnector.key
};

export function getConnectorByKey(key: string) {
  const normalizedKey = CONNECTOR_ALIASES[String(key || "").trim()] || String(key || "").trim();
  return CONNECTORS[normalizedKey] || null;
}

export function listConnectors() {
  return Object.values(CONNECTORS);
}
