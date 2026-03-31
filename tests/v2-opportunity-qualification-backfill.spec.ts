import { expect, test } from "@playwright/test";
import { buildQualificationBackfill } from "@/lib/v2/opportunity-qualification";

test("qualification backfill materializes research-only metadata for legacy opportunities", () => {
  const result = buildQualificationBackfill({
    explainability: {
      proof_authenticity: "live_derived",
      scanner_opportunity_id: "scan-1"
    },
    lifecycleStatus: "new",
    contactStatus: "unknown",
    scannerEventId: "scanner-event-1"
  });

  expect(result.changed).toBeTruthy();
  expect(result.explainability.qualification_status).toBe("research_only");
  expect(result.explainability.qualification_reason_code).toBe("missing_verified_contact");
  expect(result.explainability.scanner_event_id).toBe("scanner-event-1");
  expect(result.snapshot.researchOnly).toBeTruthy();
});

test("qualification backfill can materialize qualified contact evidence without inventing a new workflow", () => {
  const result = buildQualificationBackfill({
    explainability: {
      proof_authenticity: "live_provider",
      scanner_opportunity_id: "scan-2"
    },
    lifecycleStatus: "qualified",
    contactStatus: "identified",
    scannerEventId: "scanner-event-2",
    contactEvidence: {
      contactName: "Taylor Lead",
      phone: "631-555-0199",
      verificationStatus: "verified",
      qualificationSource: "historical_verified_lead",
      qualificationNotes: "Recovered from verified v2 lead"
    }
  });

  expect(result.changed).toBeTruthy();
  expect(result.explainability.qualification_status).toBe("qualified_contactable");
  expect(result.explainability.qualification_reason_code).toBe("historical_contactable_status");
  expect(result.snapshot.phone).toBe("+16315550199");
  expect(result.snapshot.verificationStatus).toBe("verified");
  expect(result.snapshot.researchOnly).toBeFalsy();
});

test("qualification backfill leaves explicit qualification status untouched", () => {
  const result = buildQualificationBackfill({
    explainability: {
      qualification_status: "queued_for_sdr",
      qualification_reason_code: "queued_for_sdr",
      next_recommended_action: "await_sdr_review"
    },
    lifecycleStatus: "new",
    contactStatus: "unknown"
  });

  expect(result.changed).toBeFalsy();
  expect(result.snapshot.qualificationStatus).toBe("queued_for_sdr");
});
