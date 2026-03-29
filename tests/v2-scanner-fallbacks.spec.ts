import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { GET as getScannerEvents } from "../src/app/api/scanner/events/route";
import { extractVerifiedOwnerContactFromEnrichment, hasVerifiedOwnerContact } from "../src/lib/services/contact-proof";
import { enrichOpportunityLive } from "../src/lib/services/enrichment";
import { runScanner } from "../src/lib/services/scanner";

test.describe.serial("scanner and enrichment fallbacks", () => {
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

  function buildLiveScannerFetch() {
    const forecastTime = "2026-03-16T12:00:00.000Z";
    const hourlyTimes = Array.from({ length: 6 }, (_, index) => new Date(Date.parse(forecastTime) + index * 60 * 60 * 1000).toISOString());
    const dailyTimes = Array.from({ length: 6 }, (_, index) => new Date(Date.parse(forecastTime) + index * 24 * 60 * 60 * 1000).toISOString());

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

      if (url.includes("data.cityofnewyork.us")) {
        return jsonResponse([]);
      }

      if (url.includes("www.fema.gov/api/open/v2/DisasterDeclarationsSummaries")) {
        return jsonResponse({ DisasterDeclarationsSummaries: [] });
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

  test("scanner feed route returns a warning when the persistence table is unavailable", async () => {
    await withEnv(
      {
        NODE_ENV: "development",
        REVIEW_MODE: "true",
        DEMO_MODE: undefined,
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role"
      },
      async () => {
        await withFetchMock(async (input) => {
          const url = String(input);

          if (url.includes("/rest/v1/accounts?")) {
            return jsonResponse([{ id: "acct-1" }]);
          }

          if (url.includes("/rest/v1/scanner_events?")) {
            return jsonResponse(
              { message: 'relation "public.scanner_events" does not exist' },
              { status: 400 }
            );
          }

          throw new Error(`Unexpected fetch: ${url}`);
        }, async () => {
          const response = await getScannerEvents(new NextRequest("http://localhost/api/scanner/events?limit=5"));
          expect(response.status).toBe(200);

          const body = (await response.json()) as { events?: unknown[]; warning?: string };
          expect(body.events).toEqual([]);
          expect(body.warning).toContain("unavailable locally");
        });
      }
    );
  });

  test("live scanner stays live and returns an explicit warning when geocoding cannot resolve", async () => {
    await withEnv(
      {
        DEMO_MODE: undefined,
        REVIEW_MODE: undefined
      },
      async () => {
        await withFetchMock(async () => {
          throw new Error("network unavailable");
        }, async () => {
          const result = await runScanner({
            mode: "live",
            location: "Nowhere, ZZ",
            categories: ["restoration"],
            limit: 8,
            radius: 25
          });

          expect(result.mode).toBe("live");
          expect(result.runtimeMode).toBe("live-partial");
          expect(result.locationResolved).toBeNull();
          expect(result.opportunities).toEqual([]);
          expect(result.warnings[0]).toContain("could not resolve");
          expect(result.weatherRisk.label).toBeTruthy();
        });
      }
    );
  });

  test("known markets resolve in live mode even when the network geocoder is unavailable", async () => {
    await withEnv(
      {
        DEMO_MODE: undefined,
        REVIEW_MODE: undefined
      },
      async () => {
        await withFetchMock(async (input) => {
          const url = String(input);

          if (url.includes("api.open-meteo.com/v1/forecast")) {
            return buildLiveScannerFetch()(input);
          }

          if (url.includes("api.weather.gov/alerts/active")) {
            return jsonResponse({ features: [] });
          }

          if (url.includes("www.fema.gov/api/open/v2/DisasterDeclarationsSummaries")) {
            return jsonResponse({ DisasterDeclarationsSummaries: [] });
          }

          if (url.includes("earthquake.usgs.gov")) {
            return jsonResponse({ features: [] });
          }

          if (url.includes("eonet.gsfc.nasa.gov")) {
            return jsonResponse({ events: [] });
          }

          if (url.includes("geocoding-api.open-meteo.com/v1/search")) {
            throw new Error("geocoder unavailable");
          }

          throw new Error(`Unexpected fetch: ${url}`);
        }, async () => {
          const result = await runScanner({
            mode: "live",
            location: "Hauppauge, NY 11788",
            categories: ["restoration"],
            limit: 6,
            radius: 25
          });

          expect(result.mode).toBe("live");
          expect(result.locationResolved?.label).toContain("Hauppauge, NY 11788");
          expect(result.opportunities.length).toBeGreaterThan(0);
        });
      }
    );
  });

  test("known markets resolve in live mode and keep the scanner useful", async () => {
    await withEnv(
      {
        DEMO_MODE: undefined,
        REVIEW_MODE: undefined
      },
      async () => {
        await withFetchMock(buildLiveScannerFetch(), async () => {
          const result = await runScanner({
            mode: "live",
            location: "Hauppauge, NY 11788",
            categories: ["restoration", "plumbing"],
            limit: 8,
            radius: 25
          });

          expect(result.mode).toBe("live");
          expect(result.locationResolved?.label).toContain("Hauppauge");
          expect(result.weatherRisk.highRisk).toBeTruthy();
          expect(result.opportunities.length).toBeGreaterThan(0);

          const enrichedOpportunity = result.opportunities.find((item) => Boolean((item.raw as Record<string, unknown>).enrichment));
          expect(enrichedOpportunity).toBeTruthy();
          expect(((enrichedOpportunity?.raw as Record<string, any>)?.enrichment?.propertyImageLabel)).toBe("USGS aerial image");
          expect(((enrichedOpportunity?.raw as Record<string, any>)?.enrichment?.ownerContact)).toBeNull();
          expect(hasVerifiedOwnerContact((enrichedOpportunity?.raw as Record<string, any>)?.enrichment)).toBeFalsy();
          expect(extractVerifiedOwnerContactFromEnrichment((enrichedOpportunity?.raw as Record<string, any>)?.enrichment)).toBeNull();
        });
      }
    );
  });

  test("public enrichment stays research-only when no verified owner contact is available", async () => {
    await withEnv(
      {
        DEMO_MODE: undefined,
        REVIEW_MODE: undefined
      },
      async () => {
        await withFetchMock(buildLiveScannerFetch(), async () => {
          const result = await runScanner({
            mode: "live",
            location: "Hauppauge, NY 11788",
            categories: ["restoration"],
            limit: 6,
            radius: 25
          });

          const enrichedOpportunity = result.opportunities.find((item) => Boolean((item.raw as Record<string, unknown>).enrichment));
          expect(enrichedOpportunity).toBeTruthy();
          expect(hasVerifiedOwnerContact((enrichedOpportunity?.raw as Record<string, any>)?.enrichment)).toBeFalsy();
          expect(extractVerifiedOwnerContactFromEnrichment((enrichedOpportunity?.raw as Record<string, any>)?.enrichment)).toBeNull();
          expect(((enrichedOpportunity?.raw as Record<string, any>)?.enrichment?.notes || [])).toEqual(
            expect.arrayContaining([expect.stringContaining("No verified homeowner contact data")])
          );
        });
      }
    );
  });

  test("non-tri-state markets keep forecast-driven opportunities local", async () => {
    const forecastTime = "2026-03-16T12:00:00.000Z";
    const hourlyTimes = Array.from({ length: 6 }, (_, index) => new Date(Date.parse(forecastTime) + index * 60 * 60 * 1000).toISOString());
    const dailyTimes = Array.from({ length: 6 }, (_, index) => new Date(Date.parse(forecastTime) + index * 24 * 60 * 60 * 1000).toISOString());

    await withEnv(
      {
        DEMO_MODE: undefined,
        REVIEW_MODE: undefined
      },
      async () => {
        await withFetchMock(async (input) => {
          const url = String(input);

          if (url.includes("api.open-meteo.com/v1/forecast")) {
            return jsonResponse({
              latitude: 27.9506,
              longitude: -82.4572,
              generationtime_ms: 1.2,
              utc_offset_seconds: -14400,
              timezone: "America/New_York",
              timezone_abbreviation: "ET",
              elevation: 14,
              current: {
                time: forecastTime,
                interval: 1,
                temperature_2m: 78,
                apparent_temperature: 80,
                precipitation_probability: 84,
                weather_code: 61,
                wind_speed_10m: 28
              },
              hourly: {
                time: hourlyTimes,
                temperature_2m: [78, 77, 76, 75, 74, 73],
                precipitation_probability: [84, 82, 80, 76, 70, 66],
                weather_code: [61, 61, 61, 61, 61, 61],
                wind_speed_10m: [28, 26, 24, 23, 22, 21]
              },
              daily: {
                time: dailyTimes,
                weather_code: [61, 61, 61, 61, 61, 61],
                temperature_2m_max: [80, 81, 82, 83, 84, 85],
                temperature_2m_min: [72, 71, 70, 69, 68, 67],
                precipitation_probability_max: [84, 80, 76, 72, 68, 64]
              }
            });
          }

          if (url.includes("api.weather.gov/alerts/active")) {
            return jsonResponse({ features: [] });
          }

          if (url.includes("www.fema.gov/api/open/v2/DisasterDeclarationsSummaries")) {
            return jsonResponse({ DisasterDeclarationsSummaries: [] });
          }

          if (url.includes("earthquake.usgs.gov")) {
            return jsonResponse({ features: [] });
          }

          if (url.includes("eonet.gsfc.nasa.gov")) {
            return jsonResponse({ events: [] });
          }

          if (url.includes("geocoding.geo.census.gov/geocoder/geographies/onelineaddress")) {
            return jsonResponse({ result: { addressMatches: [] } });
          }

          if (url.includes("api.census.gov/data/2023/acs/acs5")) {
            return jsonResponse([
              ["B25077_001E", "zip code tabulation area"],
              ["425000", "33602"]
            ]);
          }

          throw new Error(`Unexpected fetch: ${url}`);
        }, async () => {
          const result = await runScanner({
            mode: "live",
            location: "Tampa, FL 33602",
            categories: ["restoration"],
            limit: 6,
            radius: 25
          });

          expect(result.mode).toBe("live");
          expect(result.opportunities.length).toBeGreaterThan(0);
          expect(result.opportunities.some((item) => String(item.raw?.property_state).toUpperCase() === "FL")).toBeTruthy();
          expect(result.opportunities.every((item) => !/NY|NJ|CT/.test(String(item.raw?.property_state || "")))).toBeTruthy();
        });
      }
    );
  });

  test("public enrichment falls back to a usable public-record visual object without premium provider", async () => {
    await withEnv(
      {
        SERVICE_BUTLER_ENRICHMENT_URL: undefined,
        SERVICE_BUTLER_ENRICHMENT_TOKEN: undefined,
        SERVICE_BUTLER_ENRICHMENT_PROVIDER: undefined
      },
      async () => {
        await withFetchMock(buildLiveScannerFetch(), async () => {
          const result = await enrichOpportunityLive({
            address: "120 Motor Pkwy",
            city: "Hauppauge",
            state: "NY",
            postalCode: "11788",
            serviceType: "Water Mitigation"
          });

          expect(result).toBeTruthy();
          expect(result?.provider).toBe("US Census geocoder + ACS + USGS imagery");
          expect(result?.simulated).toBeFalsy();
          expect(result?.propertyImageLabel).toBe("USGS aerial image");
          expect(result?.propertyImageUrl).toContain("basemap.nationalmap.gov");
          expect(result?.propertyImageSource).toBe("USGS The National Map imagery");
          expect(result?.propertyValueVerification).toBe("estimated");
          expect(result?.ownerContact).toBeNull();
          expect(result?.notes.some((note) => note.includes("No verified homeowner contact data"))).toBeTruthy();
        });
      }
    );
  });
});
