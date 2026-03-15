import type { ConnectorAdapter } from "@/lib/v2/connectors/types";
import { weatherConnector } from "@/lib/v2/connectors/weather";
import { permitsConnector } from "@/lib/v2/connectors/permits";
import { socialIntentConnector } from "@/lib/v2/connectors/social";
import { incidentConnector } from "@/lib/v2/connectors/incidents";

const CONNECTORS: Record<string, ConnectorAdapter> = {
  [weatherConnector.key]: weatherConnector,
  [permitsConnector.key]: permitsConnector,
  [socialIntentConnector.key]: socialIntentConnector,
  [incidentConnector.key]: incidentConnector
};

export function getConnectorByKey(key: string) {
  return CONNECTORS[key] || null;
}

export function listConnectors() {
  return Object.values(CONNECTORS);
}
