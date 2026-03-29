import { expect, test } from "@playwright/test";
import {
  buildQualificationUpdate,
  buildResearchOnlyDispatchPayload,
  getOpportunityQualificationSnapshot,
  validateQualificationMutation
} from "@/lib/v2/opportunity-qualification";

test("qualification snapshot keeps research-only public signals out of buyer proof", () => {
  const snapshot = getOpportunityQualificationSnapshot({
    explainability: {
      qualification_status: "research_only",
      qualification_reason_code: "missing_verified_contact",
      next_recommended_action: "route_to_sdr",
      proof_authenticity: "live_derived",
      scanner_opportunity_id: "scan-1"
    },
    proofAuthenticity: "live_derived"
  });

  expect(snapshot.qualificationStatus).toBe("research_only");
  expect(snapshot.researchOnly).toBeTruthy();
  expect(snapshot.requiresSdrQualification).toBeTruthy();
  expect(snapshot.scannerEventId).toBe("scan-1");
});

test("qualification update requires provenance for qualified contactable records", () => {
  const validationError = validateQualificationMutation({
    qualification_status: "qualified_contactable",
    contact_name: "Taylor Lead",
    phone: "631-555-0199"
  });

  expect(validationError).toContain("qualification_source");
});

test("qualification update stores verified contact provenance without schema changes", () => {
  const update = buildQualificationUpdate({
    explainability: {
      proof_authenticity: "live_derived",
      scanner_opportunity_id: "scan-2"
    },
    mutation: {
      qualification_status: "qualified_contactable",
      contact_name: "Taylor Lead",
      phone: "6315550199",
      verification_status: "verified",
      qualification_source: "scanner_operator",
      qualification_notes: "Verified callback path"
    },
    actorUserId: "user-1"
  });

  expect(update.lifecycleStatus).toBe("qualified");
  expect(update.contactStatus).toBe("identified");
  expect(update.explainability.qualification_status).toBe("qualified_contactable");
  expect(update.explainability.qualification_source).toBe("scanner_operator");
  expect(update.explainability.phone).toBe("6315550199");
});

test("research-only dispatch payload stays structured for scanner UI", () => {
  const payload = buildResearchOnlyDispatchPayload({
    scannerEventId: "scanner-event-1",
    opportunityId: "opp-1",
    sourceType: "open311",
    proofAuthenticity: "live_derived"
  });

  expect(payload.status).toBe("research_only");
  expect(payload.reason_code).toBe("missing_verified_contact");
  expect(payload.next_step).toBe("route_to_sdr");
  expect(payload.opportunity_id).toBe("opp-1");
});
