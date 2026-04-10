import { expect, test } from "@playwright/test";
import { open311Connector } from "../src/lib/v2/connectors/open311";
import { runConnectorForSource } from "../src/lib/v2/connectors/runner";

function createSupabaseMock() {
  const connectorRuns: Array<Record<string, unknown>> = [];
  const sourceEvents: Array<Record<string, unknown>> = [];
  const opportunities: Array<Record<string, unknown>> = [];
  const signals: Array<Record<string, unknown>> = [];
  const v2Leads: Array<Record<string, unknown>> = [];

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
          postalCode: "",
          ids: [] as string[]
        };

        const selectBuilder = {
          eq(field: string, value: unknown) {
            if (field === "tenant_id") state.tenantId = String(value || "");
            if (field === "service_line") state.serviceLine = String(value || "");
            if (field === "id") state.id = String(value || "");
            if (field === "postal_code") state.postalCode = String(value || "");
            return selectBuilder;
          },
          in(field: string, values: unknown[]) {
            if (field === "id") state.ids = values.map((value) => String(value || ""));
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
            if (state.ids.length > 0) rows = rows.filter((row) => state.ids.includes(String(row.id)));
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
          update: (patch: Record<string, unknown>) => ({
            eq: async (_field: string, value: unknown) => {
              const index = opportunities.findIndex((row) => String(row.id) === String(value));
              if (index >= 0) opportunities[index] = { ...opportunities[index], ...patch };
              return { data: null, error: null };
            }
          })
        };
      }

      if (table === "v2_leads") {
        const state = {
          tenantId: "",
          postalCode: ""
        };

        const selectBuilder = {
          eq(field: string, value: unknown) {
            if (field === "tenant_id") state.tenantId = String(value || "");
            if (field === "postal_code") state.postalCode = String(value || "");
            return selectBuilder;
          },
          order() {
            return selectBuilder;
          },
          limit() {
            return selectBuilder;
          },
          then(resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
            let rows = v2Leads.filter((row) => String(row.tenant_id) === state.tenantId);
            if (state.postalCode) rows = rows.filter((row) => String(row.postal_code) === state.postalCode);
            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
          }
        };

        return {
          select: () => selectBuilder
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

      throw new Error(`Unexpected table access: ${table}`);
    }
  };

  return { supabaseMock, connectorRuns, sourceEvents, opportunities, signals, v2Leads };
}

test("open311 source creates real opportunities and marks missing contact as the dispatch blocker", async () => {
  const previousFetch = globalThis.fetch;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  const { supabaseMock, connectorRuns, sourceEvents, opportunities } = createSupabaseMock();
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async (input) => {
    const url = String(input);
    if (!url.includes("/rest/v1/v2_audit_logs")) throw new Error(`Unexpected fetch: ${url}`);
    return new Response(JSON.stringify([{ id: "audit-1" }]), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  };
  try {
    const result = await runConnectorForSource({
      supabase: supabaseMock as never,
      tenantId: "tenant-1",
      sourceId: "source-open311-1",
      sourceType: "open311",
      sourceConfig: {
        source_name: "Open311 Service Requests",
        terms_status: "approved",
        sample_records: [
          {
            service_request_id: "sr-1",
            created_at: "2026-04-07T10:00:00.000Z",
            service_name: "WATER LEAK",
            description: "Basement taking on water after pipe leak.",
            incident_address: "101 Atlantic Ave",
            borough: "BROOKLYN",
            incident_zip: "11201"
          }
        ]
      },
      actorUserId: "user-1",
      connector: open311Connector
    });

    expect(result.status).toBe("completed");
    expect(sourceEvents).toHaveLength(1);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]?.contact_status).toBe("unknown");
    expect((opportunities[0]?.explainability_json as Record<string, unknown>)?.missing_contact_data).toBeTruthy();
    expect((opportunities[0]?.explainability_json as Record<string, unknown>)?.qualification_status).toBe("research_only");
    expect((opportunities[0]?.explainability_json as Record<string, unknown>)?.qualification_reason_code).toBe("missing_contact_data_from_source");

    const metadata = (connectorRuns[0]?.metadata as Record<string, unknown>) || {};
    expect(metadata.raw_records_fetched).toBe(1);
    expect(metadata.normalized_records).toBe(1);
    expect(metadata.source_events_written).toBe(1);
    expect(metadata.opportunities_created).toBe(1);
    expect(metadata.contact_missing).toBe(1);
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  }
});

test("open311 source can mark a source-backed contact as dispatchable when the payload is genuinely contactable", async () => {
  const previousFetch = globalThis.fetch;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  const { supabaseMock, opportunities } = createSupabaseMock();
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async (input) => {
    const url = String(input);
    if (!url.includes("/rest/v1/v2_audit_logs")) throw new Error(`Unexpected fetch: ${url}`);
    return new Response(JSON.stringify([{ id: "audit-2" }]), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  };
  try {
    await runConnectorForSource({
      supabase: supabaseMock as never,
      tenantId: "tenant-1",
      sourceId: "source-open311-2",
      sourceType: "open311",
      sourceConfig: {
        source_name: "Open311 Service Requests",
        terms_status: "approved",
        sample_records: [
          {
            service_request_id: "sr-2",
            created_at: "2026-04-07T10:00:00.000Z",
            service_name: "FIRE DAMAGE",
            description: "Commercial kitchen smoke damage and sprinkler activation.",
            incident_address: "250 Front St",
            borough: "MANHATTAN",
            incident_zip: "10038",
            contact_name: "Front Street Deli",
            contact_phone: "2125551234",
            contact_email: "ops@frontstreetdeli.com"
          }
        ]
      },
      actorUserId: "user-1",
      connector: open311Connector
    });

    expect(opportunities).toHaveLength(1);
    const explainability = (opportunities[0]?.explainability_json as Record<string, unknown>) || {};
    expect(opportunities[0]?.contact_status).toBe("identified");
    expect(explainability.contact_attached).toBeTruthy();
    expect(explainability.qualification_status).toBe("qualified_contactable");
    expect((explainability.qualification_contact as Record<string, unknown>)?.verification_status).toBe("verified");
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  }
});

test("open311 source can attach grounded contact from a matching verified historical lead", async () => {
  const previousFetch = globalThis.fetch;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  const { supabaseMock, opportunities, v2Leads } = createSupabaseMock();
  opportunities.push({
    id: "prior-opp-1",
    tenant_id: "tenant-1",
    service_line: "restoration",
    created_at: "2026-04-03T09:00:00.000Z"
  });
  v2Leads.push({
    id: "lead-verified-1",
    tenant_id: "tenant-1",
    opportunity_id: "prior-opp-1",
    contact_name: "Atlantic Bakery",
    property_address: "101 Atlantic Ave",
    city: "BROOKLYN",
    state: "NY",
    postal_code: "11201",
    created_at: "2026-04-03T10:00:00.000Z",
    lead_status: "verified",
    do_not_contact: false,
    contact_channels_json: {
      phone: "7185551000",
      email: "ops@atlanticbakery.com",
      verification_status: "verified",
      verification_score: 91,
      contact_provenance: "crm:verified_call_back",
      contact_evidence: ["crm:verified_call_back"]
    }
  });
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async (input) => {
    const url = String(input);
    if (!url.includes("/rest/v1/v2_audit_logs")) throw new Error(`Unexpected fetch: ${url}`);
    return new Response(JSON.stringify([{ id: "audit-3" }]), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  };
  try {
    await runConnectorForSource({
      supabase: supabaseMock as never,
      tenantId: "tenant-1",
      sourceId: "source-open311-3",
      sourceType: "open311",
      sourceConfig: {
        source_name: "Open311 Service Requests",
        terms_status: "approved",
        sample_records: [
          {
            service_request_id: "sr-3",
            created_at: "2026-04-07T10:00:00.000Z",
            service_name: "WATER LEAK",
            description: "Basement taking on water after pipe leak.",
            incident_address: "101 Atlantic Ave",
            borough: "BROOKLYN",
            incident_zip: "11201"
          }
        ]
      },
      actorUserId: "user-1",
      connector: open311Connector
    });

    const created = opportunities.find((row) => Boolean(row.explainability_json) && String(row.source_event_id || "").startsWith("event-"));
    const explainability = (created?.explainability_json as Record<string, unknown>) || {};
    expect(created?.contact_status).toBe("identified");
    expect(explainability.contact_attached).toBeTruthy();
    expect(explainability.contact_attachment_reason).toBe("historical_verified_lead");
    expect(explainability.contact_attachment_status).toBe("grounded_attached");
    expect(explainability.qualification_source).toBe("historical_verified_lead");
    expect(explainability.qualification_status).toBe("qualified_contactable");
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  }
});

test("open311 source keeps weak historical contact blocked with explicit grounding status", async () => {
  const previousFetch = globalThis.fetch;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  const { supabaseMock, opportunities, v2Leads } = createSupabaseMock();
  opportunities.push({
    id: "prior-opp-2",
    tenant_id: "tenant-1",
    service_line: "plumbing",
    created_at: "2026-04-03T09:00:00.000Z"
  });
  v2Leads.push({
    id: "lead-verified-plumbing",
    tenant_id: "tenant-1",
    opportunity_id: "prior-opp-2",
    contact_name: "Atlantic Bakery",
    property_address: "101 Atlantic Ave",
    city: "BROOKLYN",
    state: "NY",
    postal_code: "11201",
    created_at: "2026-04-03T10:00:00.000Z",
    lead_status: "verified",
    do_not_contact: false,
    contact_channels_json: {
      phone: "7185552000",
      verification_status: "verified",
      verification_score: 88,
      contact_provenance: "crm:verified_call_back",
      contact_evidence: ["crm:verified_call_back"]
    }
  });
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async (input) => {
    const url = String(input);
    if (!url.includes("/rest/v1/v2_audit_logs")) throw new Error(`Unexpected fetch: ${url}`);
    return new Response(JSON.stringify([{ id: "audit-4" }]), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  };
  try {
    await runConnectorForSource({
      supabase: supabaseMock as never,
      tenantId: "tenant-1",
      sourceId: "source-open311-4",
      sourceType: "open311",
      sourceConfig: {
        source_name: "Open311 Service Requests",
        terms_status: "approved",
        sample_records: [
          {
            service_request_id: "sr-4",
            created_at: "2026-04-07T10:00:00.000Z",
            service_name: "WATER LEAK",
            description: "Basement taking on water after pipe leak.",
            incident_address: "101 Atlantic Ave",
            borough: "BROOKLYN",
            incident_zip: "11201"
          }
        ]
      },
      actorUserId: "user-1",
      connector: open311Connector
    });

    const created = opportunities.find((row) => Boolean(row.explainability_json) && String(row.source_event_id || "").startsWith("event-"));
    const explainability = (created?.explainability_json as Record<string, unknown>) || {};
    expect(created?.contact_status).toBe("unknown");
    expect(explainability.contact_attached).toBeFalsy();
    expect(explainability.contact_attachment_status).toBe("insufficient_grounding");
    expect(explainability.qualification_reason_code).toBe("contact_found_but_not_sufficiently_grounded");
    expect(explainability.missing_contact_data).toBeFalsy();
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  }
});

test("open311 source can attach a grounded verified contact from an existing v2 lead", async () => {
  const previousFetch = globalThis.fetch;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  const { supabaseMock, opportunities, connectorRuns, v2Leads } = createSupabaseMock();
  opportunities.push({
    id: "opp-existing-1",
    tenant_id: "tenant-1",
    service_line: "restoration",
    postal_code: "11201",
    created_at: "2026-04-01T12:00:00.000Z"
  });
  v2Leads.push({
    id: "lead-verified-1",
    tenant_id: "tenant-1",
    opportunity_id: "opp-existing-1",
    contact_name: "Atlantic Hardware",
    property_address: "101 Atlantic Ave",
    city: "BROOKLYN",
    state: "NY",
    postal_code: "11201",
    service_type: "Water Mitigation",
    lead_status: "verified",
    created_at: "2026-04-01T12:00:00.000Z",
    contact_channels_json: {
      phone: "+17185550199",
      verification_status: "verified",
      verification_score: 92,
      contact_provenance: "v2_leads:historical_verified"
    }
  });
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async (input) => {
    const url = String(input);
    if (!url.includes("/rest/v1/v2_audit_logs")) throw new Error(`Unexpected fetch: ${url}`);
    return new Response(JSON.stringify([{ id: "audit-3" }]), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  };
  try {
    await runConnectorForSource({
      supabase: supabaseMock as never,
      tenantId: "tenant-1",
      sourceId: "source-open311-3",
      sourceType: "open311",
      sourceConfig: {
        source_name: "Open311 Service Requests",
        terms_status: "approved",
        sample_records: [
          {
            service_request_id: "sr-3",
            created_at: "2026-04-07T10:00:00.000Z",
            service_name: "WATER LEAK",
            description: "Basement taking on water after pipe leak.",
            incident_address: "101 Atlantic Ave",
            borough: "BROOKLYN",
            incident_zip: "11201"
          }
        ]
      },
      actorUserId: "user-1",
      connector: open311Connector
    });

    const createdOpportunity = opportunities.find(
      (row) => Boolean(row.explainability_json) && String(row.source_event_id || "").startsWith("event-")
    );
    expect(createdOpportunity?.contact_status).toBe("identified");
    const explainability = (createdOpportunity?.explainability_json as Record<string, unknown>) || {};
    expect(explainability.contact_attachment_reason).toBe("historical_verified_lead");
    expect(explainability.contact_attachment_status).toBe("grounded_attached");
    expect(explainability.contact_attachment_provenance).toBe("v2_leads:historical_verified");
    expect(explainability.matched_verified_lead_id).toBe("lead-verified-1");
    expect(explainability.qualification_status).toBe("qualified_contactable");
    expect(explainability.qualification_source).toBe("historical_verified_lead");

    const qualificationContact = (explainability.qualification_contact as Record<string, unknown>) || {};
    expect(qualificationContact.phone).toBe("+17185550199");
    expect(qualificationContact.verification_status).toBe("verified");

    const metadata = (connectorRuns[0]?.metadata as Record<string, unknown>) || {};
    expect(metadata.contact_attached_from_existing_lead).toBe(1);
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  }
});
