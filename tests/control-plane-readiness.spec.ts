import { expect, test } from "@playwright/test";
import { buildDataSourceReadinessState, buildEnvironmentReadinessState } from "@/lib/control-plane/readiness";
import type { DataSourceSummary } from "@/lib/control-plane/types";

function makeSource(overrides: Partial<DataSourceSummary> = {}): DataSourceSummary {
  return {
    id: "source-1",
    catalogKey: "weather.noaa",
    connectorKey: "weather.noaa",
    family: "Weather",
    sourceType: "weather",
    name: "NOAA Alerts",
    description: "Weather feed",
    configured: true,
    status: "active",
    runtimeMode: "fully-live",
    termsStatus: "approved",
    complianceStatus: "approved",
    freshness: 92,
    freshnessTimestamp: new Date().toISOString(),
    freshnessLabel: "5m ago",
    reliability: 88,
    latestRunStatus: "completed",
    latestRunCompletedAt: new Date().toISOString(),
    latestEventAt: new Date().toISOString(),
    recordsSeen: 15,
    recordsCreated: 4,
    provenance: "api.weather.gov",
    liveRequirements: [],
    buyerReadinessNote: "Live-safe and eligible for buyer-proof reporting.",
    config: {},
    configTemplate: {},
    rateLimitPolicy: {},
    ...overrides
  };
}

test("environment readiness blocks live mutations with remediation", () => {
  const readiness = buildEnvironmentReadinessState("Live writes are disabled.", "Enable v2 writes before using this action.");

  expect(readiness.mode).toBe("blocked");
  expect(readiness.live).toBeFalsy();
  expect(readiness.blockingIssues[0]?.code).toBe("not_live_in_environment");
  expect(readiness.recommendedActions).toContain("Enable live v2 reads and writes for this environment.");
});

test("data source readiness marks simulated and terms-blocked sources as blocked", () => {
  const simulated = buildDataSourceReadinessState(
    makeSource({
      runtimeMode: "simulated",
      buyerReadinessNote: "Visible to operators, but still simulated and excluded from buyer-proof metrics."
    })
  );
  const termsBlocked = buildDataSourceReadinessState(
    makeSource({
      runtimeMode: "live-partial",
      termsStatus: "pending_review",
      complianceStatus: "pending_review",
      buyerReadinessNote: "Blocked for live proof until pending review terms/compliance are cleared."
    })
  );

  expect(simulated.mode).toBe("blocked");
  expect(simulated.blockingIssues.map((issue) => issue.code)).toContain("simulated");
  expect(termsBlocked.mode).toBe("blocked");
  expect(termsBlocked.blockingIssues.map((issue) => issue.code)).toContain("blocked_by_terms");
});

test("data source readiness leaves fully-live approved sources eligible", () => {
  const readiness = buildDataSourceReadinessState(makeSource());

  expect(readiness.mode).toBe("live");
  expect(readiness.blockingIssues).toHaveLength(0);
});

test("data source readiness blocks page scraping when Firecrawl credentials are missing", () => {
  const previousKey = process.env.FIRECRAWL_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;

  try {
    const readiness = buildDataSourceReadinessState(
      makeSource({
        sourceType: "incident",
        name: "Public Incident Feed",
        runtimeMode: "live-partial",
        config: {
          page_urls: ["https://county.example.gov/incidents/flood-response"],
          use_firecrawl: true
        }
      })
    );

    expect(readiness.mode).toBe("blocked");
    expect(readiness.blockingIssues.map((issue) => issue.code)).toContain("not_live_in_environment");
  } finally {
    if (previousKey !== undefined) {
      process.env.FIRECRAWL_API_KEY = previousKey;
    }
  }
});
