import { expect, test } from "@playwright/test";
import { featureFlags } from "../src/lib/config/feature-flags";
import { findTerritoryForOpportunity, routingInternals } from "../src/lib/v2/routing-engine";

type TerritoryRow = {
  id: string;
  tenant_id: string;
  zip_codes: string[];
  service_lines: string[];
  capacity_json: Record<string, unknown>;
  hours_json: Record<string, unknown>;
  active?: boolean;
};

function createTerritorySupabaseMock({
  rows,
  polygonTerritoryId
}: {
  rows: TerritoryRow[];
  polygonTerritoryId: string | null;
}) {
  const calls = {
    rpc: 0,
    contains: 0
  };

  const mock = {
    rpc: async () => {
      calls.rpc += 1;
      if (!polygonTerritoryId) return { data: [], error: null };
      return {
        data: [
          {
            territory_id: polygonTerritoryId,
            territory_name: "Matched Territory",
            territory_tenant_id: rows[0]?.tenant_id || "tenant-1",
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
          let filtered = rows.slice();
          if (filters.id) filtered = filtered.filter((row) => row.id === filters.id);
          if (filters.active != null) filtered = filtered.filter((row) => (row.active ?? true) === filters.active);
          return { data: filtered[0] || null, error: null };
        },
        then: (resolve: (value: { data: TerritoryRow[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) => {
          let filtered = rows.slice();
          if (filters.tenant_id) filtered = filtered.filter((row) => row.tenant_id === filters.tenant_id);
          if (filters.active != null) filtered = filtered.filter((row) => (row.active ?? true) === filters.active);
          const zipConstraint = filters.zip_codes as string[] | undefined;
          if (zipConstraint?.[0]) {
            filtered = filtered.filter((row) => row.zip_codes.includes(zipConstraint[0]!));
          }
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
        }
      };

      return builder;
    }
  };

  return { mock: mock as never, calls };
}

test("polygon routing uses PostGIS lookup when enabled", async () => {
  const original = featureFlags.usePolygonRouting;
  (featureFlags as { usePolygonRouting: boolean }).usePolygonRouting = true;

  const { mock, calls } = createTerritorySupabaseMock({
    rows: [
      {
        id: "territory-zip-1",
        tenant_id: "tenant-1",
        zip_codes: ["10001"],
        service_lines: ["restoration"],
        capacity_json: {},
        hours_json: {}
      },
      {
        id: "territory-poly-1",
        tenant_id: "tenant-1",
        zip_codes: ["10002"],
        service_lines: ["restoration"],
        capacity_json: {},
        hours_json: {}
      }
    ],
    polygonTerritoryId: "territory-poly-1"
  });

  const territory = await findTerritoryForOpportunity({
    supabase: mock,
    tenantId: "tenant-1",
    postalCode: "10001",
    serviceLine: "restoration",
    latitude: 40.7484,
    longitude: -73.9857
  });

  expect(calls.rpc).toBe(1);
  expect(territory?.id).toBe("territory-poly-1");

  (featureFlags as { usePolygonRouting: boolean }).usePolygonRouting = original;
});

test("zip routing remains fallback when polygon lookup returns no match", async () => {
  const original = featureFlags.usePolygonRouting;
  (featureFlags as { usePolygonRouting: boolean }).usePolygonRouting = true;

  const { mock, calls } = createTerritorySupabaseMock({
    rows: [
      {
        id: "territory-zip-1",
        tenant_id: "tenant-1",
        zip_codes: ["10001"],
        service_lines: ["restoration"],
        capacity_json: {},
        hours_json: {}
      }
    ],
    polygonTerritoryId: null
  });

  const territory = await findTerritoryForOpportunity({
    supabase: mock,
    tenantId: "tenant-1",
    postalCode: "10001",
    serviceLine: "restoration",
    latitude: 40.7484,
    longitude: -73.9857
  });

  expect(calls.rpc).toBe(1);
  expect(calls.contains).toBe(1);
  expect(territory?.id).toBe("territory-zip-1");

  (featureFlags as { usePolygonRouting: boolean }).usePolygonRouting = original;
});

test("routing parser extracts lat/lng from geography point text", () => {
  const parsed = routingInternals.parseLatLng("SRID=4326;POINT(-73.9857 40.7484)");
  expect(parsed).toEqual({ lat: 40.7484, lng: -73.9857 });
});

test("routing intelligence inputs prefer primary service line and tighten SLA for urgent clustered signals", () => {
  const input = routingInternals.resolveRoutingInputs({
    service_line: null,
    opportunity_type: "incident_signal",
    urgency_score: 88,
    catastrophe_linkage_score: 74,
    incident_cluster_id: "cluster-1",
    explainability_json: {
      primary_service_line: "plumbing",
      estimated_response_window: "0-4h"
    },
    location_text: "Buffalo, NY 14201",
    location: "SRID=4326;POINT(-78.8784 42.8864)"
  });

  expect(input.serviceLine).toBe("plumbing");
  expect(input.hasClusterMembership).toBeTruthy();
  expect(input.postalCode).toBe("14201");
  expect(input.latLng).toEqual({ lat: 42.8864, lng: -78.8784 });

  const slaMinutes = routingInternals.computeSlaMinutes({
    urgencyScore: input.urgencyScore,
    catastropheLinkageScore: input.catastropheLinkageScore,
    hasClusterMembership: input.hasClusterMembership,
    estimatedResponseWindow: input.estimatedResponseWindow
  });

  expect(slaMinutes).toBe(15);
});
