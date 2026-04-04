import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { POST as postScannerRun } from "../src/app/api/scanner/run/route";
import { GET as getScannerThroughput } from "../src/app/api/scanner/throughput/route";
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

function buildBurstRows(size: number) {
  const now = Date.parse("2026-03-20T12:00:00.000Z");
  return Array.from({ length: size }, (_, index) => ({
    service_request_id: `open311-${index + 1}`,
    service_name: index % 2 === 0 ? "Flooding" : "Fire",
    descriptor: `Urgent request ${index + 1}`,
    description: index % 2 === 0 ? "Basement flooding and water intrusion" : "Smoke and fire damage report",
    address: `${100 + index} Atlantic Ave`,
    city: "Brooklyn",
    state: "NY",
    incident_zip: "11201",
    latitude: 40.69 + index * 0.0001,
    longitude: -73.99 - index * 0.0001,
    requested_datetime: new Date(now - index * 60_000).toISOString()
  }));
}

function buildScannerRouteFetchMock(options?: {
  scannerRows?: unknown[];
  leadCount?: number;
  v2TenantId?: string;
  v2OpportunityRows?: unknown[];
  v2LeadRows?: unknown[];
}) {
  const forecastTime = "2026-03-20T12:00:00.000Z";
  const hourlyTimes = Array.from({ length: 6 }, (_, index) => new Date(Date.parse(forecastTime) + index * 60 * 60 * 1000).toISOString());
  const dailyTimes = Array.from({ length: 6 }, (_, index) => new Date(Date.parse(forecastTime) + index * 24 * 60 * 60 * 1000).toISOString());
  const open311Rows = buildBurstRows(80);
  const scannerRows = options?.scannerRows ?? [];
  const leadCount = options?.leadCount ?? 0;
  const v2OpportunityRows = options?.v2OpportunityRows ?? [];
  const v2LeadRows = options?.v2LeadRows ?? [];
  const v2TenantId = options?.v2TenantId ?? "tenant-1";

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method || "GET").toUpperCase();

    if (url.includes("geocoding-api.open-meteo.com/v1/search")) {
      return jsonResponse({
        results: [{ name: "Hauppauge", admin1: "New York", country: "United States", latitude: 40.8257, longitude: -73.2026 }]
      });
    }
    if (url.includes("api.open-meteo.com/v1/forecast")) {
      return jsonResponse({
        latitude: 40.8257,
        longitude: -73.2026,
        timezone: "America/New_York",
        current: { time: forecastTime, temperature_2m: 56, precipitation_probability: 84, weather_code: 61, wind_speed_10m: 24 },
        hourly: {
          time: hourlyTimes,
          temperature_2m: [56, 55, 54, 53, 52, 51],
          precipitation_probability: [84, 82, 80, 78, 74, 70],
          weather_code: [61, 61, 61, 61, 61, 61],
          wind_speed_10m: [24, 23, 22, 21, 20, 19]
        },
        daily: {
          time: dailyTimes,
          weather_code: [61, 61, 61, 61, 61, 61],
          temperature_2m_max: [58, 59, 60, 61, 62, 63],
          temperature_2m_min: [48, 47, 46, 45, 44, 43],
          precipitation_probability_max: [84, 80, 76, 72, 68, 64]
        }
      });
    }
    if (url.includes("weather.gov/alerts/active")) return jsonResponse({ features: [] });
    if (url.includes("earthquake.usgs.gov")) return jsonResponse({ features: [] });
    if (url.includes("eonet.gsfc.nasa.gov")) return jsonResponse({ events: [] });
    if (url.includes("www.fema.gov/api/open/v2/DisasterDeclarationsSummaries")) return jsonResponse({ DisasterDeclarationsSummaries: [] });
    if (url.includes("data.cityofnewyork.us/resource/erm2-nwe9.json")) return jsonResponse(open311Rows);
    if (url.includes("geocoding.geo.census.gov/geocoder/geographies/onelineaddress")) {
      return jsonResponse({
        result: {
          addressMatches: [
            {
              matchedAddress: "120 Motor Pkwy, Hauppauge, NY 11788",
              coordinates: { x: -73.2026, y: 40.8257 },
              addressComponents: { city: "Hauppauge", state: "NY", zip: "11788" },
              geographies: { Counties: [{ NAME: "Suffolk County" }] }
            }
          ]
        }
      });
    }
    if (url.includes("api.census.gov/data/2023/acs/acs5")) {
      return jsonResponse([
        ["B25077_001E", "zip code tabulation area"],
        ["475000", "11788"]
      ]);
    }

    if (url.includes("/rest/v1/accounts?")) return jsonResponse([{ id: "acct-1" }]);
    if (url.includes("/rest/v1/account_settings?")) return jsonResponse([]);
    if (url.includes("/rest/v1/source_events?") && method === "POST") return jsonResponse([]);
    if (url.includes("/rest/v1/scanner_events?")) {
      if (method === "POST") return jsonResponse([]);
      return jsonResponse(scannerRows);
    }
    if (url.includes("/rest/v1/opportunities?") && method === "POST") return jsonResponse([]);
    if (url.includes("/rest/v1/leads?") && method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: {
          "content-range": `0-0/${leadCount}`
        }
      });
    }
    if (url.includes("/rest/v1/v2_account_tenant_map?")) return jsonResponse({ franchise_tenant_id: v2TenantId });
    if (url.includes("/rest/v1/v2_opportunities?")) return jsonResponse(v2OpportunityRows);
    if (url.includes("/rest/v1/v2_leads?")) return jsonResponse(v2LeadRows);
    if (url.includes("/rest/v1/routing_rules?")) return jsonResponse([]);
    if (url.includes("/rest/v1/contractors?")) return jsonResponse([]);

    throw new Error(`Unexpected fetch: ${method} ${url}`);
  };
}

function buildDispatchBlockedFetchMock() {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method || "GET").toUpperCase();

    if (url.includes("/rest/v1/accounts?")) return jsonResponse([{ id: "acct-1" }]);
    if (url.includes("/rest/v1/scanner_events?")) {
      return jsonResponse({
        id: "scanner-1",
        source: "public_feed",
        category: "restoration",
        title: "Open311 flood signal",
        description: "Public flood signal with no verified contact.",
        location_text: "Hauppauge, NY 11788",
        intent_score: 70,
        confidence: 80,
        tags: ["flood"],
        lat: 40.8257,
        lon: -73.2026,
        raw: {
          source_type: "open311.generic",
          proof_authenticity: "live_provider",
          scanner_event_id: "scanner-1",
          v2_opportunity_id: "opp-1"
        }
      });
    }
    if (url.includes("/rest/v1/routing_rules?")) return jsonResponse([]);
    if (url.includes("/rest/v1/contractors?")) return jsonResponse([]);
    if (url.includes("/rest/v1/v2_account_tenant_map?")) return jsonResponse({ franchise_tenant_id: "tenant-1" });
    if (url.includes("/rest/v1/v2_opportunities?") && method === "GET") {
      return jsonResponse({
        id: "opp-1",
        lifecycle_status: "new",
        contact_status: "unknown",
        explainability_json: {
          qualification_status: "research_only",
          qualification_reason_code: "missing_verified_contact",
          next_recommended_action: "route_to_sdr",
          source_type: "open311.generic",
          proof_authenticity: "live_provider",
          scanner_event_id: "scanner-1"
        }
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${url}`);
  };
}

test.describe.serial("lane ohm scanner throughput regressions", () => {
  test("burst-scope scanner run safely handles large request limits", async () => {
    await withEnv(
      {
        NODE_ENV: "development",
        REVIEW_MODE: "true",
        DEMO_MODE: undefined,
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        SB_USE_V2_WRITES: undefined,
        SB_USE_V2_READS: undefined
      },
      async () => {
        await withFetchMock(buildScannerRouteFetchMock(), async () => {
          const response = await postScannerRun(
            new NextRequest("http://localhost/api/scanner/run", {
              method: "POST",
              body: JSON.stringify({
                mode: "live",
                marketScope: "nyc_li_burst",
                location: "NYC + Long Island",
                categories: ["restoration"],
                limit: 120,
                radius: 25
              })
            })
          );

          expect(response.status).toBe(200);
          const body = (await response.json()) as { opportunities?: Array<{ id: string }>; warnings?: string[] };
          expect(Array.isArray(body.opportunities)).toBeTruthy();
          expect((body.opportunities || []).length).toBeGreaterThan(20);
          expect((body.opportunities || []).length).toBeLessThanOrEqual(120);
          expect((body.warnings || []).some((warning) => warning.includes("Burst scan covered 7 NYC/LI markets"))).toBeTruthy();
        });
      }
    );
  });

  test("throughput API falls back to v2 tables for non-zero verified lead counts", async () => {
    await withEnv(
      {
        NODE_ENV: "development",
        REVIEW_MODE: "true",
        DEMO_MODE: undefined,
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        OPERATOR_TENANT_ID: "tenant-1"
      },
      async () => {
        await withFetchMock(
          buildScannerRouteFetchMock({
            scannerRows: [],
            leadCount: 0,
            v2OpportunityRows: [
              {
                id: "opp-1",
                contact_status: "identified",
                lifecycle_status: "qualified",
                explainability_json: {
                  scanner_event_id: "scanner-1",
                  source_type: "scanner_signal",
                  qualification_status: "qualified_contactable",
                  verification_status: "verified",
                  phone: "+15162228888",
                  proof_authenticity: "live_provider"
                }
              }
            ],
            v2LeadRows: [
              {
                id: "v2-lead-1",
                opportunity_id: "opp-1",
                contact_channels_json: {
                  phone: "+15162228888",
                  verification_status: "verified",
                  verification_score: 92
                }
              }
            ]
          }),
          async () => {
            const response = await getScannerThroughput();
            expect(response.status).toBe(200);
            const body = (await response.json()) as Record<string, number>;
            expect(body.captured_real_signals).toBeGreaterThan(0);
            expect(body.qualified_contactable_signals).toBeGreaterThan(0);
            expect(body.scanner_verified_leads_created).toBeGreaterThan(0);
          }
        );
      }
    );
  });

  test("research-only records stay blocked from dispatch without verified contact", async () => {
    await withEnv(
      {
        NODE_ENV: "development",
        REVIEW_MODE: "true",
        DEMO_MODE: undefined,
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        SB_USE_V2_READS: "true",
        SB_USE_V2_WRITES: "false"
      },
      async () => {
        await withFetchMock(buildDispatchBlockedFetchMock(), async () => {
          const response = await postScannerDispatch(
            new NextRequest("http://localhost/api/scanner/events/scanner-1/dispatch", {
              method: "POST",
              body: JSON.stringify({ createMode: "lead" })
            }),
            { params: Promise.resolve({ id: "scanner-1" }) }
          );

          expect(response.status).toBe(409);
          const body = (await response.json()) as Record<string, string>;
          expect(body.status).toBe("research_only");
          expect(body.reason_code).toBe("missing_verified_contact");
          expect(body.next_step).toBe("route_to_sdr");
          expect(body.scanner_event_id).toBe("scanner-1");
          expect(body.opportunity_id).toBe("opp-1");
        });
      }
    );
  });
});
