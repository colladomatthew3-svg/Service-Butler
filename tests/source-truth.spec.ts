import { expect, test } from "@playwright/test";
import { qualifiesAsRealSourceCapture, isIntegrationValidationRecord } from "@/lib/v2/source-truth";
import { isSyntheticScannerRecord } from "@/lib/services/scanner-truth";

const NOW = new Date("2026-04-07T12:00:00.000Z").getTime();

test("integration validation rows are excluded from real source truth", () => {
  expect(isIntegrationValidationRecord({ integration_validation: true })).toBeTruthy();
  expect(
    isSyntheticScannerRecord({
      source: "incident",
      raw: {
        proof_authenticity: "live_provider",
        integration_validation: true
      }
    })
  ).toBeTruthy();
});

test("real source capture requires approved source and event truth", () => {
  const result = qualifiesAsRealSourceCapture({
    nowMs: NOW,
    authenticity: "live_provider",
    explainability: {
      source_event_id: "event-1"
    },
    source: {
      id: "source-1",
      status: "active",
      terms_status: "approved",
      compliance_status: "approved",
      rollout_state: "pilot",
      readiness_status: "pass",
      health_status: "ok",
      freshness_timestamp: "2026-04-07T11:45:00.000Z",
      freshness_sla_minutes: 120
    },
    sourceEvent: {
      id: "event-1",
      source_id: "source-1",
      connector_run_id: "run-1",
      compliance_status: "approved"
    },
    connectorRun: {
      id: "run-1",
      status: "completed",
      metadata: {
        connector_input_mode: "live_provider"
      }
    }
  });

  expect(result).toBeTruthy();
});

test("pending review or unknown readiness sources do not count as real capture", () => {
  expect(
    qualifiesAsRealSourceCapture({
      nowMs: NOW,
      authenticity: "live_provider",
      explainability: { source_event_id: "event-1" },
      source: {
        id: "source-1",
        status: "active",
        terms_status: "approved",
        compliance_status: "pending_review",
        rollout_state: "pilot",
        readiness_status: "pass",
        health_status: "ok",
        freshness_timestamp: "2026-04-07T11:45:00.000Z",
        freshness_sla_minutes: 120
      },
      sourceEvent: {
        id: "event-1",
        source_id: "source-1",
        connector_run_id: "run-1",
        compliance_status: "approved"
      },
      connectorRun: {
        id: "run-1",
        status: "completed",
        metadata: {
          connector_input_mode: "live_provider"
        }
      }
    })
  ).toBeFalsy();

  expect(
    qualifiesAsRealSourceCapture({
      nowMs: NOW,
      authenticity: "live_provider",
      explainability: { source_event_id: "event-1" },
      source: {
        id: "source-1",
        status: "active",
        terms_status: "approved",
        compliance_status: "approved",
        rollout_state: "pilot",
        readiness_status: "unknown",
        health_status: "ok",
        freshness_timestamp: "2026-04-07T11:45:00.000Z",
        freshness_sla_minutes: 120
      },
      sourceEvent: {
        id: "event-1",
        source_id: "source-1",
        connector_run_id: "run-1",
        compliance_status: "approved"
      },
      connectorRun: {
        id: "run-1",
        status: "completed",
        metadata: {
          connector_input_mode: "live_provider"
        }
      }
    })
  ).toBeFalsy();
});
