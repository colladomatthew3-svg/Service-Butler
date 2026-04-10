import { expect, test } from "@playwright/test";
import { summarizeSourceTruth } from "@/lib/v2/source-truth-gates";

const NOW = new Date("2026-04-07T12:00:00.000Z").getTime();

test("source truth summary counts only approved pilot/live sources as live-safe", () => {
  const summary = summarizeSourceTruth(
    [
      {
        id: "source-live",
        status: "active",
        termsStatus: "approved",
        complianceStatus: "approved",
        rolloutState: "pilot",
        healthStatus: "ok",
        freshnessTimestamp: "2026-04-07T11:30:00.000Z",
        freshnessSlaMinutes: 120
      },
      {
        id: "source-blocked",
        status: "active",
        termsStatus: "approved",
        complianceStatus: "pending_review",
        rolloutState: "pilot",
        healthStatus: "ok",
        freshnessTimestamp: "2026-04-07T11:30:00.000Z",
        freshnessSlaMinutes: 120
      }
    ],
    [
      {
        sourceId: "source-live",
        complianceStatus: "approved",
        ingestedAt: "2026-04-07T11:45:00.000Z"
      },
      {
        sourceId: "source-blocked",
        complianceStatus: "approved",
        ingestedAt: "2026-04-07T11:45:00.000Z"
      }
    ],
    NOW
  );

  expect(summary.activeSources).toBe(2);
  expect(summary.liveSafeSources).toBe(1);
  expect(summary.freshLiveSafeSources).toBe(1);
  expect(summary.approvedRecentEvents).toBe(1);
  expect(summary.blockedSources).toBe(1);
});

test("source truth summary rejects stale or unhealthy sources from real-proof counts", () => {
  const summary = summarizeSourceTruth(
    [
      {
        id: "source-stale",
        status: "active",
        termsStatus: "approved",
        complianceStatus: "approved",
        rolloutState: "live",
        healthStatus: "ok",
        freshnessTimestamp: "2026-04-06T06:00:00.000Z",
        freshnessSlaMinutes: 60
      },
      {
        id: "source-unhealthy",
        status: "active",
        termsStatus: "approved",
        complianceStatus: "approved",
        rolloutState: "live",
        healthStatus: "failed",
        freshnessTimestamp: "2026-04-07T11:30:00.000Z",
        freshnessSlaMinutes: 120
      }
    ],
    [
      {
        sourceId: "source-stale",
        complianceStatus: "approved",
        ingestedAt: "2026-04-07T11:45:00.000Z"
      },
      {
        sourceId: "source-unhealthy",
        complianceStatus: "approved",
        ingestedAt: "2026-04-07T11:45:00.000Z"
      }
    ],
    NOW
  );

  expect(summary.liveSafeSources).toBe(2);
  expect(summary.freshLiveSafeSources).toBe(0);
  expect(summary.approvedRecentEvents).toBe(0);
});
