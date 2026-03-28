"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const feature_flags_1 = require("../src/lib/config/feature-flags");
const routing_engine_1 = require("../src/lib/v2/routing-engine");
function supabaseMock({ territories, polygonMatchTerritoryId }) {
    const calls = { rpc: 0, contains: 0 };
    const client = {
        rpc: async () => {
            calls.rpc += 1;
            if (!polygonMatchTerritoryId)
                return { data: [], error: null };
            return {
                data: [
                    {
                        territory_id: polygonMatchTerritoryId,
                        territory_name: "Polygon Match",
                        territory_tenant_id: territories[0]?.tenant_id || "tenant-1",
                        matched_version_no: 1,
                        match_source: "territory_version"
                    }
                ],
                error: null
            };
        },
        from: (_table) => {
            const filters = {};
            const builder = {
                select: () => builder,
                eq: (field, value) => {
                    filters[field] = value;
                    return builder;
                },
                contains: (field, value) => {
                    filters[field] = value;
                    calls.contains += 1;
                    return builder;
                },
                limit: () => builder,
                maybeSingle: async () => {
                    const row = territories.find((t) => t.id === filters.id && (filters.active == null || (t.active ?? true) === filters.active));
                    return { data: row || null, error: null };
                },
                then: (resolve, reject) => {
                    let rows = territories.slice();
                    if (filters.tenant_id)
                        rows = rows.filter((t) => t.tenant_id === filters.tenant_id);
                    if (filters.active != null)
                        rows = rows.filter((t) => (t.active ?? true) === filters.active);
                    const zip = filters.zip_codes?.[0];
                    if (zip)
                        rows = rows.filter((t) => t.zip_codes.includes(zip));
                    return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
                }
            };
            return builder;
        }
    };
    return { client: client, calls };
}
(0, test_1.test)("polygon routing path is used when SB_USE_POLYGON_ROUTING=true", async () => {
    const previous = feature_flags_1.featureFlags.usePolygonRouting;
    feature_flags_1.featureFlags.usePolygonRouting = true;
    const { client, calls } = supabaseMock({
        territories: [
            {
                id: "t-zip",
                tenant_id: "tenant-1",
                zip_codes: ["10001"],
                service_lines: ["restoration"],
                capacity_json: {},
                hours_json: {}
            },
            {
                id: "t-poly",
                tenant_id: "tenant-1",
                zip_codes: ["10002"],
                service_lines: ["restoration"],
                capacity_json: {},
                hours_json: {}
            }
        ],
        polygonMatchTerritoryId: "t-poly"
    });
    const territory = await (0, routing_engine_1.findTerritoryForOpportunity)({
        supabase: client,
        tenantId: "tenant-1",
        postalCode: "10001",
        serviceLine: "restoration",
        latitude: 40.7484,
        longitude: -73.9857
    });
    (0, test_1.expect)(calls.rpc).toBe(1);
    (0, test_1.expect)(territory?.id).toBe("t-poly");
    feature_flags_1.featureFlags.usePolygonRouting = previous;
});
(0, test_1.test)("zip routing fallback is used when polygon routing is disabled", async () => {
    const previous = feature_flags_1.featureFlags.usePolygonRouting;
    feature_flags_1.featureFlags.usePolygonRouting = false;
    const { client, calls } = supabaseMock({
        territories: [
            {
                id: "t-zip",
                tenant_id: "tenant-1",
                zip_codes: ["10001"],
                service_lines: ["restoration"],
                capacity_json: {},
                hours_json: {}
            }
        ],
        polygonMatchTerritoryId: "t-poly"
    });
    const territory = await (0, routing_engine_1.findTerritoryForOpportunity)({
        supabase: client,
        tenantId: "tenant-1",
        postalCode: "10001",
        serviceLine: "restoration",
        latitude: 40.7484,
        longitude: -73.9857
    });
    (0, test_1.expect)(calls.rpc).toBe(0);
    (0, test_1.expect)(calls.contains).toBe(1);
    (0, test_1.expect)(territory?.id).toBe("t-zip");
    feature_flags_1.featureFlags.usePolygonRouting = previous;
});
