import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

function buildScannerOpportunity(
  id: string,
  locationText: string,
  raw: Record<string, unknown> = {}
) {
  return {
    id,
    source: String(raw.source_type || "open311.generic"),
    category: "restoration",
    title: `Flooding signal in ${locationText}`,
    description: "Open311 flooding complaint near a restoration market.",
    locationText,
    lat: 40.7,
    lon: -73.9,
    intentScore: 86,
    confidence: 79,
    tags: ["flood", "water-damage"],
    nextAction: "review",
    reasonSummary: "Municipal flooding complaint with restoration fit.",
    priorityLabel: "High intent",
    recommendedCreateMode: "lead",
    recommendedScheduleIso: null,
    createdAtIso: "2026-04-03T02:00:00.000Z",
    raw: {
      connector_key: "open311.generic",
      source_name: "Open311",
      source_provenance: "data.cityofnewyork.us",
      service_type: "restoration",
      property_address: `100 ${locationText}`,
      enrichment: {},
      ...raw
    }
  };
}

function createScannerSupabaseStub() {
  const inserts = {
    sourceEvents: [] as Array<Record<string, unknown>>,
    scannerEvents: [] as Array<Record<string, unknown>>,
    opportunities: [] as Array<Record<string, unknown>>
  };

  const client = {
    from(table: string) {
      if (table === "account_settings") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            return { data: null, error: null };
          }
        };
      }

      if (table === "source_events") {
        return {
          insert(rows: Array<Record<string, unknown>>) {
            inserts.sourceEvents.push(...rows);
            return {
              async select() {
                return {
                  data: rows.map((_, index) => ({ id: `source-event-${index + 1}` })),
                  error: null
                };
              }
            };
          }
        };
      }

      if (table === "scanner_events") {
        return {
          insert(rows: Array<Record<string, unknown>>) {
            inserts.scannerEvents.push(...rows);
            return {
              async select() {
                return {
                  data: rows.map((row, index) => ({
                    id: `scanner-event-${index + 1}`,
                    raw: row.raw as Record<string, unknown>
                  })),
                  error: null
                };
              }
            };
          }
        };
      }

      if (table === "opportunities") {
        return {
          async insert(rows: Array<Record<string, unknown>>) {
            inserts.opportunities.push(...rows);
            return { error: null };
          }
        };
      }

      throw new Error(`Unexpected table access: ${table}`);
    }
  };

  return { client, inserts };
}

async function withPatchedBurstRunRoute<T>(fn: (input: { POST: (req: NextRequest) => Promise<Response> }) => Promise<T>) {
  const envKeys = ["SB_USE_V2_WRITES", "SB_USE_V2_READS", "DEMO_MODE", "REVIEW_MODE"] as const;
  const previousEnv = new Map<string, string | undefined>();
  for (const key of envKeys) {
    previousEnv.set(key, process.env[key]);
  }

  process.env.SB_USE_V2_WRITES = "false";
  process.env.SB_USE_V2_READS = "false";
  delete process.env.DEMO_MODE;
  delete process.env.REVIEW_MODE;

  const authModule = require("../src/lib/auth/rbac") as {
    getCurrentUserContext: () => Promise<unknown>;
  };
  const scannerModule = require("../src/lib/services/scanner") as {
    runScanner: (input: Record<string, unknown>) => Promise<unknown>;
  };
  const reviewModeModule = require("../src/lib/services/review-mode") as {
    isDemoMode: () => boolean;
  };

  const originalGetCurrentUserContext = authModule.getCurrentUserContext;
  const originalRunScanner = scannerModule.runScanner;
  const originalIsDemoMode = reviewModeModule.isDemoMode;

  const seenLocations: string[] = [];
  const { client, inserts } = createScannerSupabaseStub();

  authModule.getCurrentUserContext = async () => ({
    accountId: "acct-test",
    role: "ACCOUNT_OWNER",
    supabase: client
  });
  reviewModeModule.isDemoMode = () => false;
  scannerModule.runScanner = async (input) => {
    const location = String(input.location || "Unknown market");
    seenLocations.push(location);
    return {
      mode: "live",
      requestedMode: "live",
      runtimeMode: "fully-live",
      warnings: [],
      weatherRisk: { highRisk: false, label: "Stable market conditions" },
      locationResolved: { lat: 40.7, lon: -73.9, label: location },
      opportunities: [
        buildScannerOpportunity(`real-${location}`, location),
        buildScannerOpportunity(`synthetic-${location}`, location, {
          proof_authenticity: "synthetic",
          source_provenance: "operator.synthetic.open311"
        })
      ]
    };
  };

  const routePath = require.resolve("../src/app/api/scanner/run/route");
  const flagsPath = require.resolve("../src/lib/config/feature-flags");
  delete require.cache[flagsPath];
  delete require.cache[routePath];

  try {
    const routeModule = require(routePath) as { POST: (req: NextRequest) => Promise<Response> };
    return await fn({ POST: routeModule.POST });
  } finally {
    authModule.getCurrentUserContext = originalGetCurrentUserContext;
    scannerModule.runScanner = originalRunScanner;
    reviewModeModule.isDemoMode = originalIsDemoMode;
    delete require.cache[routePath];
    delete require.cache[flagsPath];
    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    expect(seenLocations.length).toBe(7);
    expect(inserts.opportunities.length).toBe(7);
  }
}

test("scanner command summary surfaces throughput KPIs", () => {
  const scannerViewSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/lead-scanner-view.tsx"),
    "utf8"
  );

  expect(scannerViewSource).toContain("Command summary");
  expect(scannerViewSource).toContain('label="24h captured"');
  expect(scannerViewSource).toContain('helper="Real scanner signals captured"');
  expect(scannerViewSource).toContain('label="24h verified-ready"');
  expect(scannerViewSource).toContain('helper="Signals with verified contactability"');
  expect(scannerViewSource).toContain('label="24h leads created"');
  expect(scannerViewSource).toContain('helper="Scanner-sourced verified leads"');
});

test("burst scope scanner route excludes synthetic opportunities from the response", async () => {
  await withPatchedBurstRunRoute(async ({ POST }) => {
    const response = await POST(
      new NextRequest("http://localhost/api/scanner/run", {
        method: "POST",
        body: JSON.stringify({
          location: "NYC + Long Island",
          marketScope: "nyc_li_burst",
          categories: ["restoration"],
          limit: 80,
          radius: 25
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      opportunities: Array<{ id: string; raw?: Record<string, unknown>; source?: string }>;
      warnings?: string[];
      runtimeMode?: string;
    };

    expect(body.runtimeMode).toBe("fully-live");
    expect(body.opportunities.length).toBe(7);
    expect(body.opportunities.every((opportunity) => !String(opportunity.id).startsWith("synthetic-"))).toBeTruthy();
    expect(
      body.opportunities.every(
        (opportunity) =>
          String(opportunity.raw?.proof_authenticity || "").toLowerCase() !== "synthetic" &&
          !String(opportunity.raw?.source_provenance || "").toLowerCase().includes("operator.synthetic")
      )
    ).toBeTruthy();
    expect(body.warnings || []).toContain("7 synthetic scanner candidates were discarded. The queue only keeps real public signals.");
    expect((body.warnings || []).some((warning) => warning.includes("Burst scan covered 7 NYC/LI markets"))).toBeTruthy();
  });
});
