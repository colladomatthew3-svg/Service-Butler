export function inferConnectorKey(sourceType: string) {
  const normalizedType = String(sourceType || "").toLowerCase();
  if (normalizedType.includes("weather")) return "weather.noaa";
  if (normalizedType.includes("permit")) return "permits.production";
  if (normalizedType.includes("social") || normalizedType.includes("reddit") || normalizedType.includes("review")) {
    return "social.intent.placeholder";
  }
  if (normalizedType.includes("incident") || normalizedType.includes("emergency")) return "incidents.generic";
  if (normalizedType.includes("usgs") || normalizedType.includes("water")) return "water.usgs";
  if (normalizedType.includes("open311") || normalizedType.includes("311")) return "open311.generic";
  if (normalizedType.includes("fema") || normalizedType.includes("disaster")) return "disaster.openfema";
  if (normalizedType.includes("census")) return "enrichment.census";
  if (normalizedType.includes("overpass") || normalizedType.includes("osm") || normalizedType.includes("property")) return "property.overpass";
  return "incidents.generic";
}

