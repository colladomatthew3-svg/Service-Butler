import { expect, test } from "@playwright/test";
import {
  buildResearchOnlyDispatchPayload,
  getOpportunityQualificationSnapshot,
  isBuyerProofEligibleQualification
} from "@/lib/v2/opportunity-qualification";

test("qualification snapshot defaults public signals to research-only until contactable", () => {
  const snapshot = getOpportunityQualificationSnapshot({
    explainability: {
      qualification_status: "research_only",
      qualification_reason_code: "missing_verified_contact",
      next_recommended_action: "route_to_sdr",
      scanner_event_id: "scanner-1"
    },
    proofAuthenticity: "live_derived"
  });

  expect(snapshot.qualificationStatus).toBe("research_only");
  expect(snapshot.researchOnly).toBeTruthy();
  expect(snapshot.requiresSdrQualification).toBeTruthy();
  expect(isBuyerProofEligibleQualification(snapshot)).toBeFalsy();
});

test("qualified contactable opportunities become buyer-proof eligible", () => {
  const snapshot = getOpportunityQualificationSnapshot({
    explainability: {
      qualification_status: "qualified_contactable",
      qualification_reason_code: "verified_contact_present",
      verification_status: "verified",
      contact_name: "Jordan Brooks",
      phone: "+16315550142"
    },
    proofAuthenticity: "live_provider",
    lifecycleStatus: "qualified",
    contactStatus: "identified"
  });

  expect(snapshot.qualificationStatus).toBe("qualified_contactable");
  expect(snapshot.researchOnly).toBeFalsy();
  expect(isBuyerProofEligibleQualification(snapshot)).toBeTruthy();
});

test("research-only dispatch payload stays structured for scanner blocking", () => {
  expect(
    buildResearchOnlyDispatchPayload({
      scannerEventId: "scanner-1",
      opportunityId: "opp-1",
      sourceType: "scanner_signal",
      proofAuthenticity: "live_derived"
    })
  ).toEqual({
    status: "research_only",
    reason_code: "missing_verified_contact",
    next_step: "route_to_sdr",
    proof_authenticity: "live_derived",
    source_type: "scanner_signal",
    scanner_event_id: "scanner-1",
    opportunity_id: "opp-1"
  });
});
