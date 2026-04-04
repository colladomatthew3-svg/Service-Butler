import { expect, test } from "@playwright/test";
import { runScanner } from "../src/lib/services/scanner";
import { GET as getScannerThroughput } from "../src/app/api/scanner/throughput/route";
import { buildQualificationUpdate, getOpportunityQualificationSnapshot, qualificationAllowsDispatch } from "../src/lib/v2/opportunity-qualification";
import { extractLeadContactCandidate, verifyLeadContactCandidate } from "../src/lib/v2/lead-verification";

async function withEnv<T>(patch: Record<string, string | undefined>, fn: () => Promise<T>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(patch)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
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

function buildHighVolumeScannerFetch() {
  const forecastTime = "2026-03-16T12:00:00.000Z";
  const hourlyTimes = Array.from({ length: 6 }, (_, index) => new Date(Date.parse(forecastTime) + index * 60 * 60 * 1000).toISOString());
  const dailyTimes = Array.from({ length: 6 }, (_, index) => new Date(Date.parse(forecastTime) + index * 24 * 60 * 60 * 1000).toISOString());
  const open311Rows = Array.from({ length: 120 }, (_, index) => ({
    service_request_id: `open311-${index + 1}`,
    service_name: "Flooding",
    descriptor: `Basement flooding complaint ${index + 1}`,
    description: `Water reported in basement unit ${index + 1}`,
    address: `${100 + index} Atlantic Ave`,
    city: "Brooklyn",
    state: "NY",
    incident_zip: "11201",
    latitude: 40.693 + index * 0.0001,
    longitude: -73.989 - index * 0.0001,
    requested_datetime: new Date(Date.parse(forecastTime) - index * 60_000).toISOString()
  }));

  return async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("geocoding-api.open-meteo.com/v1/search")) {
      return jsonResponse({
        results: [
          {
            name: "Hauppauge",
            admin1: "New York",
            country: "United States",
            latitude: 40.8257,
            longitude: -73.2026
          }
        ]
      });
    }

    if (url.includes("api.open-meteo.com/v1/forecast")) {
      return jsonResponse({
        latitude: 40.8257,
        longitude: -73.2026,
        generationtime_ms: 1.2,
        utc_offset_seconds: -18000,
        timezone: "America/New_York",
        timezone_abbreviation: "ET",
        elevation: 30,
        current: {
          time: forecastTime,
          interval: 1,
          temperature_2m: 56,
          apparent_temperature: 54,
          precipitation_probability: 82,
          weather_code: 61,
          wind_speed_10m: 24
        },
        hourly: {
          time: hourlyTimes,
          temperature_2m: [56, 55, 54, 53, 52, 51],
          precipitation_probability: [82, 84, 86, 80, 74, 68],
          weather_code: [61, 61, 61, 61, 61, 61],
          wind_speed_10m: [24, 23, 22, 21, 20, 19]
        },
        daily: {
          time: dailyTimes,
          weather_code: [61, 61, 61, 61, 61, 61],
          temperature_2m_max: [58, 59, 60, 61, 62, 63],
          temperature_2m_min: [48, 47, 46, 45, 44, 43],
          precipitation_probability_max: [82, 80, 76, 72, 68, 64]
        }
      });
    }

    if (url.includes("weather.gov/alerts/active")) {
      return jsonResponse({ features: [] });
    }

    if (url.includes("earthquake.usgs.gov")) {
      return jsonResponse({ features: [] });
    }

    if (url.includes("eonet.gsfc.nasa.gov")) {
      return jsonResponse({ events: [] });
    }

    if (url.includes("www.fema.gov/api/open/v2/DisasterDeclarationsSummaries")) {
      return jsonResponse({ DisasterDeclarationsSummaries: [] });
    }

    if (url.includes("data.cityofnewyork.us/resource/erm2-nwe9.json")) {
      return jsonResponse(open311Rows);
    }

    if (url.includes("geocoding.geo.census.gov/geocoder/geographies/onelineaddress")) {
      return jsonResponse({
        result: {
          addressMatches: [
            {
              matchedAddress: "120 Motor Pkwy, Hauppauge, NY 11788",
              coordinates: { x: -73.2026, y: 40.8257 },
              addressComponents: {
                city: "Hauppauge",
                state: "NY",
                zip: "11788"
              },
              geographies: {
                Counties: [{ NAME: "Suffolk County" }]
              }
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

    throw new Error(`Unexpected fetch: ${url}`);
  };
}

test.describe.serial("scanner throughput and verification", () => {
  test("live scanner safely supports requested limits above 50", async () => {
    await withEnv(
      {
        DEMO_MODE: undefined,
        REVIEW_MODE: undefined
      },
      async () => {
        await withFetchMock(buildHighVolumeScannerFetch(), async () => {
          const result = await runScanner({
            mode: "live",
            location: "Hauppauge, NY 11788",
            categories: ["restoration"],
            limit: 80,
            radius: 25
          });

          expect(result.mode).toBe("live");
          expect(result.runtimeMode).toBe("fully-live");
          expect(result.locationResolved?.label).toContain("Hauppauge");
          expect(result.opportunities.length).toBeGreaterThan(50);
          expect(result.opportunities.length).toBeLessThanOrEqual(80);
          expect(new Set(result.opportunities.map((item) => item.id)).size).toBe(result.opportunities.length);
          expect(
            result.opportunities.filter((item) => String(item.raw?.connector_key || "") === "open311.generic").length
          ).toBeGreaterThan(50);
        });
      }
    );
  });

  test("normalized public contact fields can become verified and dispatch-eligible", () => {
    const candidate = extractLeadContactCandidate({
      sourceEvent: {
        normalized_payload: {
          contact_name: "Harbor Property Group",
          contact_phone: "516-222-8888",
          contact_email: "ops@harborpm.com"
        }
      },
      opportunity: {
        title: "Open311 basement flooding signal"
      }
    });

    const verification = verifyLeadContactCandidate(candidate, {
      sourceReliability: 82,
      freshnessScore: 76,
      hasMultiSignal: true,
      duplicatePhone: false,
      duplicateEmail: false,
      duplicateAddress: false
    });

    expect(verification.status).toBe("verified");
    expect(verification.contactable).toBeTruthy();
    expect(verification.phone).toBe("+15162228888");
    expect(verification.email).toBe("ops@harborpm.com");

    const update = buildQualificationUpdate({
      explainability: {
        proof_authenticity: "live_provider",
        source_type: "open311.generic",
        scanner_event_id: "scanner-verified-1"
      },
      mutation: {
        qualification_status: "qualified_contactable",
        contact_name: verification.name,
        phone: verification.phone,
        email: verification.email,
        verification_status: verification.status,
        qualification_source: "normalized_public_contact",
        qualification_notes: "Verified from normalized payload contact fields"
      },
      actorUserId: "dispatcher-1"
    });

    const snapshot = getOpportunityQualificationSnapshot({
      explainability: update.explainability,
      proofAuthenticity: "live_provider",
      lifecycleStatus: update.lifecycleStatus,
      contactStatus: update.contactStatus
    });

    expect(snapshot.qualificationStatus).toBe("qualified_contactable");
    expect(snapshot.researchOnly).toBeFalsy();
    expect(snapshot.requiresSdrQualification).toBeFalsy();
    expect(snapshot.verificationStatus).toBe("verified");
    expect(snapshot.phone).toBe("+15162228888");
    expect(snapshot.email).toBe("ops@harborpm.com");
    expect(qualificationAllowsDispatch(snapshot)).toBeTruthy();
  });

  test("throughput uses v2 truth fallback when legacy scanner feed is empty after synthetic filtering", async () => {
    await withEnv(
      {
        NODE_ENV: "development",
        REVIEW_MODE: "true",
        DEMO_MODE: undefined,
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
        OPERATOR_TENANT_ID: "tenant-ops-1"
      },
      async () => {
        await withFetchMock(async (input, init) => {
          const url = String(input);
          const method = String(init?.method || "GET").toUpperCase();

          if (url.includes("/rest/v1/accounts?")) {
            return jsonResponse([{ id: "acct-1" }]);
          }

          if (url.includes("/rest/v1/scanner_events?")) {
            return jsonResponse([
              {
                id: "scanner-synthetic-1",
                source: "public_feed",
                raw: {
                  proof_authenticity: "synthetic",
                  source_type: "scanner_signal"
                },
                created_at: "2026-04-01T10:00:00.000Z"
              }
            ]);
          }

          if (url.includes("/rest/v1/leads?") && method === "HEAD") {
            return new Response(null, {
              status: 200,
              headers: {
                "content-range": "0-0/0"
              }
            });
          }

          if (url.includes("/rest/v1/v2_opportunities?")) {
            return jsonResponse([
              {
                id: "opp-v2-1",
                contact_status: "identified",
                lifecycle_status: "qualified",
                created_at: "2026-04-01T10:01:00.000Z",
                explainability_json: {
                  scanner_event_id: "scanner-live-1",
                  source_type: "scanner_signal",
                  qualification_status: "qualified_contactable",
                  verification_status: "verified",
                  phone: "+15162228888",
                  proof_authenticity: "live_provider"
                }
              }
            ]);
          }

          if (url.includes("/rest/v1/v2_leads?")) {
            return jsonResponse([
              {
                id: "v2-lead-1",
                created_at: "2026-04-01T10:02:00.000Z",
                opportunity_id: "opp-v2-1",
                contact_channels_json: {
                  phone: "+15162228888",
                  verification_status: "verified",
                  verification_score: 91
                }
              }
            ]);
          }

          throw new Error(`Unexpected fetch: ${method} ${url}`);
        }, async () => {
          const response = await getScannerThroughput();
          expect(response.status).toBe(200);

          const body = (await response.json()) as {
            captured_real_signals: number;
            qualified_contactable_signals: number;
            research_only_signals: number;
            scanner_verified_leads_created: number;
          };

          // Synthetic legacy scanner rows should be excluded from truth metrics.
          expect(body.captured_real_signals).toBe(1);
          expect(body.qualified_contactable_signals).toBe(1);
          expect(body.research_only_signals).toBe(0);
          expect(body.scanner_verified_leads_created).toBe(1);
        });
      }
    );
  });
});
