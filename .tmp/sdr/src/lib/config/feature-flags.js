"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureFlags = void 0;
function envFlag(name) {
    const value = String(process.env[name] || "").trim().toLowerCase();
    return value === "1" || value === "true" || value === "on" || value === "yes";
}
exports.featureFlags = {
    useV2Reads: envFlag("SB_USE_V2_READS"),
    useV2Writes: envFlag("SB_USE_V2_WRITES"),
    usePolygonRouting: envFlag("SB_USE_POLYGON_ROUTING")
};
