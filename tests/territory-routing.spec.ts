import { expect, test } from "@playwright/test";
import { featureFlags } from "../src/lib/config/feature-flags";
import { findTerritoryForOpportunity } from "../src/lib/v2/routing-engine";

type Territory = {
  id: string;
  tenant_id: string;
  zip_codes: string[];
  service_lines: string[];
  capacity_json: Record<string, unknown>;
  hours_json: Record<string, unknown>;
  active?: boolean;
};

function supabaseMock({
  territories,
  polygonMatchTerritoryId
}: {
  territories: Territory[];
  polygonMatchTerritoryId: string | null;
}) {
  const calls = { rpc: 0, contains: 0 };

  const client = {
    rpc: async () => {
      calls.rpc += 1;
      if (!polygonMatchTerritoryId) return { data: [], error: null };
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
    from: (_table: string) => {
      const filters: Record<string, unknown> = {};

      const builder = {
        select: () => builder,
        eq: (field: string, value: unknown) => {
          filters[field] = value;
          return builder;
        },
        contains: (field: string, value: unknown) => {
          filters[field] = value;
          calls.contains += 1;
          return builder;
        },
        limit: () => builder,
        maybeSingle: async () => {
          const row = territories.find((t) => t.id === filters.id && (filters.active == null || (t.active ?? true) === filters.active));
          return { data: row || null, error: null };
        },
        then: (resolve: (value: { data: Territory[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) => {
          let rows = territories.slice();
          if (filters.tenant_id) rows = rows.filter((t) => t.tenant_id === filters.tenant_id);
          if (filters.active != null) rows = rows.filter((t) => (t.active ?? true) === filters.active);
          const zip = (filters.zip_codes as string[] | undefined)?.[0];
          if (zip) rows = rows.filter((t) => t.zip_codes.includes(zip));
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        }
      };

      return builder;
    }
  };

  return { client: client as never, calls };
}

test("polygon routing path is used when SB_USE_POLYGON_ROUTING=true", async () => {
  const previous = featureFlags.usePolygonRouting;
  (featureFlags as { usePolygonRouting: boolean }).usePolygonRouting = true;

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

  const territory = await findTerritoryForOpportunity({
    supabase: client,
    tenantId: "tenant-1",
    postalCode: "10001",
    serviceLine: "restoration",
    latitude: 40.7484,
    longitude: -73.9857
  });

  expect(calls.rpc).toBe(1);
  expect(territory?.id).toBe("t-poly");

  (featureFlags as { usePolygonRouting: boolean }).usePolygonRouting = previous;
});

test("zip routing fallback is used when polygon routing is disabled", async () => {
  const previous = featureFlags.usePolygonRouting;
  (featureFlags as { usePolygonRouting: boolean }).usePolygonRouting = false;

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

  const territory = await findTerritoryForOpportunity({
    supabase: client,
    tenantId: "tenant-1",
    postalCode: "10001",
    serviceLine: "restoration",
    latitude: 40.7484,
    longitude: -73.9857
  });

  expect(calls.rpc).toBe(0);
  expect(calls.contains).toBe(1);
  expect(territory?.id).toBe("t-zip");

  (featureFlags as { usePolygonRouting: boolean }).usePolygonRouting = previous;
});
