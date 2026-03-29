import { expect, test } from "@playwright/test";
import { buildDataSourceReadinessState, buyerReadinessNoteForSource } from "@/lib/control-plane/readiness";

test("data-source readiness blocks simulated and terms-gated sources", () => {
  const readiness = buildDataSourceReadinessState({
    id: "source-1",
    catalogKey: "permits.primary",
    connectorKey: "permits.primary",
    family: "Permits",
    sourceType: "permits",
    name: "Building Permits",
    description: "Permit feed",
    configured: true,
    status: "active",
    runtimeMode: "simulated",
    termsStatus: "pending_review",
    complianceStatus: "pending_review",
    freshness: 0,
    freshnessTimestamp: null,
    freshnessLabel: "Not configured",
    reliability: 70,
    latestRunStatus: null,
    latestRunCompletedAt: null,
    latestEventAt: null,
    recordsSeen: 0,
    recordsCreated: 0,
    provenance: "permits.provider",
    liveRequirements: ["Provider URL"],
    buyerReadinessNote: "",
    config: {},
    configTemplate: {},
    rateLimitPolicy: {}
  });

  expect(readiness.mode).toBe("blocked");
  expect(readiness.live).toBeFalsy();
  expect(readiness.blockingIssues.map((entry) => entry.code)).toEqual(expect.arrayContaining(["simulated", "blocked_by_terms"]));
});

test("buyer readiness note tells the truth about live-safe sources", () => {
  expect(
    buyerReadinessNoteForSource({
      name: "NOAA Weather Alerts",
      configured: true,
      status: "active",
      runtimeMode: "fully-live",
      termsStatus: "approved",
      complianceStatus: "approved"
    })
  ).toContain("eligible for buyer-proof");
});
