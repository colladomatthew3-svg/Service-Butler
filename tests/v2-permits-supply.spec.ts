import { expect, test } from "@playwright/test";
import { permitsConnector } from "../src/lib/v2/connectors/permits";
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
        const state = { tenantId: "", serviceLine: "", id: "", postalCode: "", ids: [] as string[] };
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
                const row = { id: `opp-${opportunities.length + 1}`, created_at: new Date().toISOString(), ...payload };
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
        const state = { tenantId: "", postalCode: "" };
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

function buildFetchMock(responders: Array<(url: string) => Response | null>) {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    for (const responder of responders) {
      const response = responder(url);
      if (response) return response;
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
}

test("permits source creates real opportunities and marks identity-only source contact as blocked", async () => {
  const previousFetch = globalThis.fetch;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  const { supabaseMock, connectorRuns, opportunities } = createSupabaseMock();
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = buildFetchMock([
    (url) =>
      url.includes("/rest/v1/v2_audit_logs")
        ? new Response(JSON.stringify([{ id: "audit-permit-1" }]), {
            status: 201,
            headers: { "content-type": "application/json" }
          })
        : null
  ]) as typeof fetch;
  try {
    await runConnectorForSource({
      supabase: supabaseMock as never,
      tenantId: "tenant-1",
      sourceId: "source-permits-1",
      sourceType: "permits",
      sourceConfig: {
        source_name: "NYC DOB NOW Approved Permits",
        terms_status: "approved",
        sample_records: [
          {
            job_filing_number: "Q01233321-S1",
            work_permit: "Q01233321-S1-SP",
            issued_date: "2026-04-07T00:00:00.000Z",
            house_no: "89-43",
            street_name: "165 STREET",
            zip_code: "11432",
            applicant_business_name: "Titan Industrial",
            owner_business_name: "PR",
            owner_name: "AMI WEINSTOCK",
            permit_status: "Signed-off",
            job_description: "SPRINKLER SYSTEM REMOVAL"
          }
        ]
      },
      actorUserId: "user-1",
      connector: permitsConnector
    });

    expect(opportunities).toHaveLength(1);
    const explainability = (opportunities[0]?.explainability_json as Record<string, unknown>) || {};
    expect(opportunities[0]?.contact_status).toBe("unknown");
    expect(explainability.contact_attachment_status).toBe("identity_only");
    expect(explainability.qualification_reason_code).toBe("source_contact_identity_only");

    const metadata = (connectorRuns[0]?.metadata as Record<string, unknown>) || {};
    expect(metadata.contact_identity_only).toBe(1);
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  }
});

test("permits source can mark native source-backed phone contact as dispatchable", async () => {
  const previousFetch = globalThis.fetch;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  const { supabaseMock, opportunities } = createSupabaseMock();
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = buildFetchMock([
    (url) =>
      url.includes("/rest/v1/v2_audit_logs")
        ? new Response(JSON.stringify([{ id: "audit-permit-2" }]), {
            status: 201,
            headers: { "content-type": "application/json" }
          })
        : null
  ]) as typeof fetch;
  try {
    await runConnectorForSource({
      supabase: supabaseMock as never,
      tenantId: "tenant-1",
      sourceId: "source-permits-2",
      sourceType: "permits",
      sourceConfig: {
        source_name: "Native Contact Permits",
        terms_status: "approved",
        sample_records: [
          {
            id: "permit-verified-1",
            permit_type: "Plumbing Repair",
            issued_date: "2026-04-07T00:00:00.000Z",
            address: "101 Atlantic Ave",
            postal_code: "11201",
            owner_name: "Atlantic Hardware",
            owner_phone: "7184440199",
            owner_email: "ops@atlantichardware.com",
            description: "Emergency sewer repair"
          }
        ]
      },
      actorUserId: "user-1",
      connector: permitsConnector
    });

    expect(opportunities).toHaveLength(1);
    const explainability = (opportunities[0]?.explainability_json as Record<string, unknown>) || {};
    expect(opportunities[0]?.contact_status).toBe("identified");
    expect(explainability.contact_attached).toBeTruthy();
    expect(explainability.qualification_status).toBe("qualified_contactable");
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  }
});

test("permits source can attach grounded contact from official DOB license info using exact applicant license", async () => {
  const previousFetch = globalThis.fetch;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  const { supabaseMock, opportunities, connectorRuns } = createSupabaseMock();
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = buildFetchMock([
    (url) =>
      url.includes("/rest/v1/v2_audit_logs")
        ? new Response(JSON.stringify([{ id: "audit-permit-3" }]), {
            status: 201,
            headers: { "content-type": "application/json" }
          })
        : null,
    (url) =>
      url.includes("data.cityofnewyork.us/resource/t8hj-ruu2.json")
        ? new Response(
            JSON.stringify([
              {
                license_number: "625287",
                license_type: "GENERAL CONTRACTOR",
                business_name: "RISHON HOMES CORP",
                business_phone_number: "5164354570",
                business_email: "asnadi4@yahoo.com",
                license_status: "ACTIVE"
              }
            ]),
            {
              status: 200,
              headers: { "content-type": "application/json" }
            }
          )
        : null
  ]) as typeof fetch;
  try {
    await runConnectorForSource({
      supabase: supabaseMock as never,
      tenantId: "tenant-1",
      sourceId: "source-permits-3",
      sourceType: "permits",
      sourceConfig: {
        source_name: "NYC DOB NOW Approved Permits",
        source_provenance: "https://data.cityofnewyork.us/Housing-Development/DOB-NOW-Build-Approved-Permits/rbx6-tga4",
        terms_status: "approved",
        sample_records: [
          {
            job_filing_number: "X01233321-S1",
            work_permit: "X01233321-S1-SP",
            issued_date: "2026-04-07T00:00:00.000Z",
            house_no: "90-22",
            street_name: "196 STREET",
            zip_code: "11432",
            applicant_license: "625287",
            permittee_s_license_type: "GC",
            applicant_business_name: "RISHON HOMES CORP",
            applicant_business_address: "15 WILLOW LANE",
            owner_business_name: "CITIWIDE HOMES INC.",
            owner_name: "AMAR SOOKRA",
            permit_status: "Signed-off",
            job_description: "Full demolition of one-family frame building"
          }
        ]
      },
      actorUserId: "user-1",
      connector: permitsConnector
    });

    expect(opportunities).toHaveLength(1);
    const explainability = (opportunities[0]?.explainability_json as Record<string, unknown>) || {};
    const qualificationContact = (explainability.qualification_contact as Record<string, unknown>) || {};
    expect(opportunities[0]?.contact_status).toBe("identified");
    expect(explainability.contact_attachment_reason).toBe("dob_license_info");
    expect(explainability.contact_attachment_status).toBe("grounded_attached");
    expect(explainability.qualification_reason_code).toBe("verified_contact_attached_from_dob_license");
    expect(qualificationContact.phone).toBe("+15164354570");
    expect(String(explainability.contact_attachment_provenance || "")).toContain("DOB-License-Info");

    const metadata = (connectorRuns[0]?.metadata as Record<string, unknown>) || {};
    expect(metadata.contact_attached).toBe(1);
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  }
});

test("permits source does not attach DOB license contact when permit business identity conflicts", async () => {
  const previousFetch = globalThis.fetch;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  const { supabaseMock, opportunities } = createSupabaseMock();
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = buildFetchMock([
    (url) =>
      url.includes("/rest/v1/v2_audit_logs")
        ? new Response(JSON.stringify([{ id: "audit-permit-4" }]), {
            status: 201,
            headers: { "content-type": "application/json" }
          })
        : null,
    (url) =>
      url.includes("data.cityofnewyork.us/resource/t8hj-ruu2.json")
        ? new Response(
            JSON.stringify([
              {
                license_number: "625287",
                license_type: "GENERAL CONTRACTOR",
                business_name: "DIFFERENT COMPANY LLC",
                business_phone_number: "5164354570",
                business_email: "asnadi4@yahoo.com",
                license_status: "ACTIVE"
              }
            ]),
            {
              status: 200,
              headers: { "content-type": "application/json" }
            }
          )
        : null
  ]) as typeof fetch;
  try {
    await runConnectorForSource({
      supabase: supabaseMock as never,
      tenantId: "tenant-1",
      sourceId: "source-permits-4",
      sourceType: "permits",
      sourceConfig: {
        source_name: "NYC DOB NOW Approved Permits",
        terms_status: "approved",
        sample_records: [
          {
            job_filing_number: "Y01233321-S1",
            work_permit: "Y01233321-S1-SP",
            issued_date: "2026-04-07T00:00:00.000Z",
            house_no: "90-22",
            street_name: "196 STREET",
            zip_code: "11432",
            applicant_license: "625287",
            permittee_s_license_type: "GC",
            applicant_business_name: "RISHON HOMES CORP",
            permit_status: "Signed-off",
            job_description: "Full demolition"
          }
        ]
      },
      actorUserId: "user-1",
      connector: permitsConnector
    });

    expect(opportunities).toHaveLength(1);
    const explainability = (opportunities[0]?.explainability_json as Record<string, unknown>) || {};
    expect(opportunities[0]?.contact_status).toBe("unknown");
    expect(explainability.contact_attachment_status).toBe("insufficient_grounding");
    expect(explainability.qualification_reason_code).toBe("contact_found_but_not_sufficiently_grounded");
    expect(String(explainability.contact_grounded_reason || "")).toContain("business identity conflicted");
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  }
});
