function envFlag(name: string) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

export const featureFlags = {
  useV2Reads: envFlag("SB_USE_V2_READS"),
  useV2Writes: envFlag("SB_USE_V2_WRITES"),
  usePolygonRouting: envFlag("SB_USE_POLYGON_ROUTING")
} as const;

export type FeatureFlags = typeof featureFlags;
