import { expect, test } from "@playwright/test";
import { incidentConnector } from "../src/lib/v2/connectors/incidents";
import { runConnectorForSource } from "../src/lib/v2/connectors/runner";

test("Firecrawl-backed incident source creates an operator-facing opportunity", async () => {
  const previousFetch = globalThis.fetch;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

  const connectorRuns: Array<Record<string, unknown>> = [];
  const sourceEvents: Array<Record<string, unknown>> = [];
  const opportunities: Array<Record<string, unknown>> = [];
  const signals: Array<Record<string, unknown>> = [];
  const auditEvents: Array<Record<string, unknown>> = [];

  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async (input, init) => {
    const url = String(input);

    if (url === "https://api.firecrawl.dev/v2/scrape") {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            markdown: "Emergency crews on scene after basement flooding from a water main break.",
            metadata: {
              title: "County flood response bulletin",
              description: "Basement flooding and emergency response activity",
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
    }

    if (url.includes("/rest/v1/v2_audit_logs")) {
      auditEvents.push(JSON.parse(String(init?.body || "{}")) as Record<string, unknown>);
      return new Response(JSON.stringify([{ id: "audit-1" }]), {
        status: 201,
        headers: { "content-type": "application/json" }
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const supabaseMock = {
    from(table: string) {
      if (table === "v2_connector_runs") {
        return {
          insert: (payload: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const row = { id: `run-${connectorRuns.length + 1}`, ...payload };
                connectorRuns.push(row);
                return { data: row, error: null };
              }
            })
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (_field: string, value: unknown) => {
              const index = connectorRuns.findIndex((row) => String(row.id) === String(value));
              if (index >= 0) connectorRuns[index] = { ...connectorRuns[index], ...patch };
              return { data: null, error: null };
            }
          })
        };
      }

      if (table === "v2_tenants") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { settings_json: { vertical: "restoration" } },
                error: null
              })
            })
          })
        };
      }

      if (table === "v2_source_events") {
        return {
          upsert: (payload: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const row = { id: `event-${sourceEvents.length + 1}`, ...payload };
                sourceEvents.push(row);
                return { data: row, error: null };
              }
            })
          })
        };
      }

      if (table === "v2_opportunities") {
        const state = {
          tenantId: "",
          serviceLine: "",
          id: "",
          postalCode: ""
        };

        const selectBuilder = {
          eq(field: string, value: unknown) {
            if (field === "tenant_id") state.tenantId = String(value || "");
            if (field === "service_line") state.serviceLine = String(value || "");
            if (field === "id") state.id = String(value || "");
            if (field === "postal_code") state.postalCode = String(value || "");
            return selectBuilder;
          },
          gte() {
            return selectBuilder;
          },
          not() {
            return selectBuilder;
          },
          contains() {
            return selectBuilder;
          },
          order() {
            return selectBuilder;
          },
          limit() {
            return selectBuilder;
          },
          maybeSingle: async () => {
            const match = opportunities.find((row) => String(row.id) === state.id && String(row.tenant_id) === state.tenantId) || null;
            return { data: match, error: null };
          },
          then(resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
            let rows = opportunities.filter((row) => String(row.tenant_id) === state.tenantId);
            if (state.serviceLine) rows = rows.filter((row) => String(row.service_line) === state.serviceLine);
            if (state.postalCode) rows = rows.filter((row) => String(row.postal_code) === state.postalCode);
            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
          }
        };

        return {
          select: () => selectBuilder,
          insert: (payload: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const row = {
                  id: `opp-${opportunities.length + 1}`,
                  created_at: new Date().toISOString(),
                  ...payload
                };
                opportunities.push(row);
                return { data: row, error: null };
              }
            })
          }),
          update: () => ({
            eq: async () => ({ data: null, error: null })
          })
        };
      }

      if (table === "v2_opportunity_signals") {
        return {
          insert: async (payload: Array<Record<string, unknown>>) => {
            signals.push(...payload);
            return { data: null, error: null };
          }
        };
      }

      if (table === "v2_incident_clusters") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: async () => ({ data: [], error: null })
                  })
                })
              })
            })
          }),
          update: () => ({
            eq: async () => ({ data: null, error: null })
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "cluster-1" }, error: null })
            })
          })
        };
      }

      throw new Error(`Unexpected table access: ${table}`);
    }
  };

  try {
    const result = await runConnectorForSource({
      supabase: supabaseMock as never,
      tenantId: "tenant-1",
      sourceId: "source-incident-1",
      sourceType: "incident",
      sourceConfig: {
        source_name: "County Incidents",
        terms_status: "approved",
        use_firecrawl: true,
        firecrawl_api_key: "fc-test-key",
        page_urls: ["https://county.example.gov/incidents/flood-response"],
        location_text: "Buffalo, NY"
      },
      actorUserId: "user-1",
      connector: incidentConnector
    });

    expect(result.status).toBe("completed");
    expect(result.recordsCreated).toBe(1);
    expect(sourceEvents).toHaveLength(1);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]?.title).toBe("County flood response bulletin");
    expect(opportunities[0]?.opportunity_type).toBe("flood_incident");
    expect(opportunities[0]?.service_line).toBe("restoration");
    expect(String((sourceEvents[0]?.normalized_payload as Record<string, unknown>)?.source_provenance || "")).toBe(
      "https://county.example.gov/incidents/flood-response"
    );
    expect(signals.length).toBeGreaterThan(0);
    expect(auditEvents.length).toBeGreaterThan(0);
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;

    if (previousSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    }

    if (previousServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
    }
  }
});
