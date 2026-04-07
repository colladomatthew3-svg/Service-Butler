import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { POST as postScannerDispatch } from "../src/app/api/scanner/events/[id]/dispatch/route";

async function withEnv<T>(patch: Record<string, string | undefined>, fn: () => Promise<T>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(patch)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function withFetchMock<T>(fetchImpl: typeof fetch, fn: () => Promise<T>) {
  const previousFetch = globalThis.fetch;
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchImpl;
  try {
    return await fn();
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
  }
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {})
    }
  });
}

function buildDispatchFetchMock() {
  const state = {
    leads: [
      {
        id: "lead-1",
        account_id: "acct-1",
        status: "new",
        stage: "NEW",
        name: "Jane Owner",
        phone: "+17165550000",
        service_type: "Restoration",
        address: "123 Main St",
        city: "Buffalo",
        state: "NY",
        postal_code: "14201",
        requested_timeframe: "Today",
        notes: "Existing scanner lead",
        converted_job_id: null,
        scheduled_for: null,
        created_at: "2026-04-06T10:00:00.000Z"
      }
    ] as Array<Record<string, unknown>>,
    jobs: [
      {
        id: "job-1",
        account_id: "acct-1",
        lead_id: "lead-1"
      }
    ] as Array<Record<string, unknown>>,
    leadJobs: [
      {
        account_id: "acct-1",
        lead_id: "lead-1",
        job_id: "job-1"
      }
    ] as Array<Record<string, unknown>>,
    v2Leads: [] as Array<Record<string, unknown>>
  };

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = String(init?.method || "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : null;

    if (url.toString().includes("api.open-meteo.com/v1/forecast")) {
      return jsonResponse({
        current: { time: "2026-04-06T12:00:00.000Z", temperature_2m: 52, precipitation_probability: 40, weather_code: 61, wind_speed_10m: 10 },
        hourly: { time: [], temperature_2m: [], precipitation_probability: [], weather_code: [], wind_speed_10m: [] },
        daily: { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_probability_max: [] }
      });
    }

    if (url.pathname.endsWith("/rest/v1/accounts")) return jsonResponse([{ id: "acct-1" }]);
    if (url.pathname.endsWith("/rest/v1/routing_rules")) return jsonResponse([]);
    if (url.pathname.endsWith("/rest/v1/contractors")) return jsonResponse([]);
    if (url.pathname.endsWith("/rest/v1/opportunities")) return jsonResponse([]);

    if (url.pathname.endsWith("/rest/v1/scanner_events")) {
      return jsonResponse({
        id: "scanner-1",
        source: "public_feed",
        category: "restoration",
        title: "Water incident",
        description: "Basement flooding reported.",
        location_text: "123 Main St, Buffalo, NY 14201",
        intent_score: 82,
        confidence: 90,
        tags: ["water"],
        lat: 42.8864,
        lon: -78.8784,
        raw: {
          enrichment: {
            ownerContact: {
              name: "Jane Owner",
              phone: "+17165550000",
              email: "jane@example.com",
              verification: "verified"
            }
          }
        }
      });
    }

    if (url.pathname.endsWith("/rest/v1/leads")) {
      if (method === "GET") return jsonResponse(state.leads);
      if (method === "POST") {
        const row = { id: `lead-${state.leads.length + 1}`, created_at: new Date().toISOString(), ...body };
        state.leads.push(row);
        return jsonResponse(row);
      }
      if (method === "PATCH") {
        const id = url.searchParams.get("id")?.replace("eq.", "") || "";
        const accountId = url.searchParams.get("account_id")?.replace("eq.", "") || "";
        const index = state.leads.findIndex((row) => String(row.id) === id && String(row.account_id) === accountId);
        if (index >= 0) state.leads[index] = { ...state.leads[index], ...body };
        return jsonResponse(state.leads[index] || null);
      }
    }

    if (url.pathname.endsWith("/rest/v1/lead_intent_signals")) return jsonResponse([]);

    if (url.pathname.endsWith("/rest/v1/lead_jobs")) {
      if (method === "GET") {
        const leadId = url.searchParams.get("lead_id")?.replace("eq.", "") || "";
        const accountId = url.searchParams.get("account_id")?.replace("eq.", "") || "";
        return jsonResponse(state.leadJobs.find((row) => String(row.lead_id) === leadId && String(row.account_id) === accountId) || null);
      }
      if (method === "POST") {
        state.leadJobs.push(body);
        return jsonResponse(body);
      }
    }

    if (url.pathname.endsWith("/rest/v1/jobs")) {
      if (method === "POST") {
        const row = { id: `job-${state.jobs.length + 1}`, ...body };
        state.jobs.push(row);
        return jsonResponse(row);
      }
    }

    if (url.pathname.endsWith("/rest/v1/v2_account_tenant_map")) return jsonResponse({ franchise_tenant_id: "tenant-1" });
    if (url.pathname.endsWith("/rest/v1/v2_opportunities")) return jsonResponse([]);
    if (url.pathname.endsWith("/rest/v1/v2_leads")) {
      if (method === "GET") return jsonResponse(state.v2Leads);
      if (method === "POST") {
        const row = { id: `v2-lead-${state.v2Leads.length + 1}`, ...body };
        state.v2Leads.push(row);
        return jsonResponse(row);
      }
      if (method === "PATCH") return jsonResponse({});
    }
    if (url.pathname.endsWith("/rest/v1/v2_jobs")) return jsonResponse(null);

    throw new Error(`Unexpected fetch: ${method} ${url.toString()}`);
  };
}

test.describe.serial("scanner dispatch lead dedupe", () => {
  test("re-dispatch reuses existing lead and existing job without creating duplicates", async () => {
    await withEnv(
      {
        NODE_ENV: "development",
        REVIEW_MODE: "true",
        DEMO_MODE: undefined,
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        SB_USE_V2_READS: "false",
        SB_USE_V2_WRITES: "false"
      },
      async () => {
        await withFetchMock(buildDispatchFetchMock(), async () => {
          const response = await postScannerDispatch(
            new NextRequest("http://localhost/api/scanner/events/scanner-1/dispatch", {
              method: "POST",
              body: JSON.stringify({ createMode: "job" })
            }),
            { params: Promise.resolve({ id: "scanner-1" }) }
          );

          expect(response.status).toBe(200);
          const payload = (await response.json()) as Record<string, unknown>;
          expect(payload.leadId).toBe("lead-1");
          expect(payload.jobId).toBe("job-1");
          expect(payload.leadReused).toBeTruthy();
          expect(String(payload.leadMatchReason || "")).toContain("verified phone");
        });
      }
    );
  });
});
