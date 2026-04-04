import { expect, test } from "@playwright/test";
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

test("scanner run route returns an explicit empty-queue warning after synthetic filtering", async () => {
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

  process.env.SB_USE_V2_WRITES = "false";
  process.env.SB_USE_V2_READS = "false";
  delete process.env.DEMO_MODE;
  delete process.env.REVIEW_MODE;

  authModule.getCurrentUserContext = async () => ({
    accountId: "acct-test",
    role: "ACCOUNT_OWNER",
    supabase: {
      from() {
        throw new Error("unexpected persistence access");
      }
    }
  });
  reviewModeModule.isDemoMode = () => false;
  scannerModule.runScanner = async (input) => {
    const location = String(input.location || "Unknown market");
    return {
      mode: "live",
      requestedMode: "live",
      runtimeMode: "fully-live",
      warnings: [],
      weatherRisk: { highRisk: false, label: "Stable market conditions" },
      locationResolved: { lat: 40.7, lon: -73.9, label: location },
      opportunities: [
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
    const response = await routeModule.POST(
      new NextRequest("http://localhost/api/scanner/run", {
        method: "POST",
        body: JSON.stringify({
          location: "NYC + Long Island",
          marketScope: "nyc_li_burst",
          categories: ["restoration"],
          limit: 1,
          radius: 25
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      opportunities: Array<{ id: string }>;
      warnings?: string[];
    };

    expect(body.opportunities).toEqual([]);
    expect(body.warnings || []).toContain("1 synthetic scanner candidate were discarded. No real public signals remain in the queue.");
    expect((body.warnings || []).some((warning) => warning.includes("No real scanner opportunities remained after filtering out 1 synthetic demo candidate"))).toBeTruthy();
  } finally {
    authModule.getCurrentUserContext = originalGetCurrentUserContext;
    scannerModule.runScanner = originalRunScanner;
    reviewModeModule.isDemoMode = originalIsDemoMode;
    delete require.cache[routePath];
    delete require.cache[flagsPath];
  }
});
