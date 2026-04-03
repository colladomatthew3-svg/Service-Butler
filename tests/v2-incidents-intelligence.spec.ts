import { expect, test } from "@playwright/test";
import { incidentConnector } from "../src/lib/v2/connectors/incidents";
import { connectorRunnerInternals } from "../src/lib/v2/connectors/runner";

test("incident intelligence normalizes fire/water/infrastructure categories", async () => {
  const events = await incidentConnector.normalize(
    [
      {
        id: "inc-1",
        event_type: "Fire Response",
        title: "Apartment fire with smoke damage",
        occurred_at: "2026-03-16T09:00:00.000Z",
        city: "New York",
        state: "NY"
      },
      {
        id: "inc-2",
        event_type: "Flood Response",
        title: "Water main break and basement flooding",
        occurred_at: "2026-03-16T10:00:00.000Z"
      },
      {
        id: "inc-3",
        event_type: "Utility Outage",
        title: "Infrastructure outage event",
        occurred_at: "2026-03-16T11:00:00.000Z"
      }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-incident-1",
      sourceType: "incident",
      config: {
        source_name: "Public Incident Feed",
        source_provenance: "city.incidents",
        terms_status: "approved"
      }
    }
  );

  expect(events).toHaveLength(3);
  expect(events[0]?.eventCategory).toBe("fire_incident");
  expect(events[0]?.likelyJobType).toBe("fire restoration");
  expect(events[1]?.eventCategory).toBe("water_incident");
  expect(events[1]?.serviceLineCandidates).toContain("plumbing");
  expect(events[2]?.eventCategory).toBe("infrastructure_failure");
  expect(events[2]?.serviceLineCandidates).toContain("electrical");
});

test("incident connector keeps Citizen-like sources compliance-gated by default", () => {
  delete process.env.SB_ENABLE_CITIZEN_CONNECTOR;

  const policy = incidentConnector.compliancePolicy({
    tenantId: "tenant-1",
    sourceId: "source-incident-2",
    sourceType: "incident",
    config: {
      source_name: "Citizen Feed",
      terms_status: "approved"
    }
  });

  expect(policy.ingestionAllowed).toBeFalsy();
  expect(policy.requiresLegalReview).toBeTruthy();
  expect(policy.termsStatus).toBe("restricted");
});

test("incident connector can scrape page-based public incident sources with Firecrawl", async () => {
  const previousFetch = globalThis.fetch;
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}")) as { url?: string };
    expect(body.url).toBe("https://county.example.gov/incidents/flood-response");

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          markdown: "Water main break causing basement flooding and emergency crews on scene.",
          metadata: {
            title: "Flood response update",
            description: "Public works flood response",
            sourceURL: "https://county.example.gov/incidents/flood-response",
            publishedTime: "2026-03-16T10:00:00.000Z"
          }
        }
      }),
      {
        headers: {
          "content-type": "application/json"
        }
      }
    );
  };

  try {
    const records = await incidentConnector.pull({
      tenantId: "tenant-1",
      sourceId: "source-incident-firecrawl",
      sourceType: "incident",
      config: {
        terms_status: "approved",
        source_name: "County Incidents",
        page_urls: ["https://county.example.gov/incidents/flood-response"],
        use_firecrawl: true,
        firecrawl_api_key: "fc-test-key",
        city: "Buffalo",
        state: "NY"
      }
    });

    expect(records).toHaveLength(1);
    expect(records[0]?.event_type).toBe("water_incident");
    expect(records[0]?.source_provenance).toBe("https://county.example.gov/incidents/flood-response");
    expect(records[0]?.title).toBe("Flood response update");
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
  }
});

test("incident cluster logic groups nearby events inside the active time window", async () => {
  const clusters: Array<Record<string, unknown>> = [];

  const supabaseMock = {
    from: (table: string) => {
      if (table !== "v2_incident_clusters") throw new Error(`Unexpected table ${table}`);

      const filters: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        eq: (field: string, value: unknown) => {
          filters[field] = value;
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        then: (resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown, reject?: (reason: unknown) => unknown) => {
          let data = clusters.slice();
          if (filters.tenant_id) data = data.filter((row) => row.tenant_id === filters.tenant_id);
          if (filters.cluster_type) data = data.filter((row) => row.cluster_type === filters.cluster_type);
          if (filters.status) data = data.filter((row) => row.status === filters.status);
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async (_field: string, value: unknown) => {
            const idx = clusters.findIndex((row) => String(row.id) === String(value));
            if (idx >= 0) clusters[idx] = { ...clusters[idx], ...patch };
            return { data: null, error: null };
          }
        }),
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              const inserted = {
                id: `cluster-${clusters.length + 1}`,
                ...row
              };
              clusters.push(inserted);
              return { data: { id: inserted.id }, error: null };
            }
          })
        })
      };

      return builder;
    }
  };

  const first = await connectorRunnerInternals.upsertIncidentClusterFromEvent({
    supabase: supabaseMock as never,
    tenantId: "tenant-1",
    event: {
      occurredAt: "2026-03-16T12:00:00.000Z",
      dedupeKey: "incident-1",
      eventType: "fire_incident",
      eventCategory: "fire_incident",
      title: "Fire response",
      latitude: 40.7484,
      longitude: -73.9857,
      severityHint: 86,
      rawPayload: {},
      normalizedPayload: {}
    }
  });

  const second = await connectorRunnerInternals.upsertIncidentClusterFromEvent({
    supabase: supabaseMock as never,
    tenantId: "tenant-1",
    event: {
      occurredAt: "2026-03-16T12:20:00.000Z",
      dedupeKey: "incident-2",
      eventType: "fire_incident",
      eventCategory: "fire_incident",
      title: "Smoke damage follow-up",
      latitude: 40.749,
      longitude: -73.9862,
      severityHint: 80,
      rawPayload: {},
      normalizedPayload: {}
    }
  });

  expect(first?.clusterId).toBeTruthy();
  expect(second?.clusterId).toBe(first?.clusterId);
  expect(second?.signalCount).toBe(2);
});
