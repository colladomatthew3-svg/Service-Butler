import { expect, test } from "@playwright/test";
import { getPrimaryAction, getSourceLane, type Opportunity } from "../src/components/dashboard/opportunities-view";

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp-1",
    category: "incident_signal",
    service_line: "restoration",
    title: "Opportunity",
    description: "Source-backed demand signal.",
    location_text: "Buffalo, NY",
    zip: "14201",
    intent_score: 72,
    confidence: 78,
    urgency_score: 81,
    signal_count: 3,
    source_types: ["open311"],
    confidence_reasoning: "311 water complaint.",
    estimated_response_window: "0-4h",
    distress_context_summary: "Municipal water complaint near service area.",
    qualification_status: "research_only",
    qualification_reason_code: "missing_verified_contact",
    proof_authenticity: "live_derived",
    next_recommended_action: "route_to_sdr",
    research_only: true,
    requires_sdr_qualification: true,
    created_at: "2026-04-01T12:00:00.000Z",
    ...overrides
  };
}

test("research-only municipal opportunities route into the SDR lane with a focused opportunity id", () => {
  const item = makeOpportunity();

  expect(getSourceLane(item)).toBe("311");
  expect(getPrimaryAction(item)).toEqual(
    expect.objectContaining({
      href: "/dashboard/scanner?queue=sdr&opportunity=opp-1",
      label: "Send to SDR"
    })
  );
});

test("queued SDR opportunities keep the operator in the SDR lane for the same opportunity", () => {
  const item = makeOpportunity({
    id: "opp-queued",
    source_types: ["openfema", "flood"],
    confidence_reasoning: "OpenFEMA flood response signal.",
    distress_context_summary: "Flooding and water intrusion after severe rain.",
    qualification_status: "queued_for_sdr",
    research_only: false,
    requires_sdr_qualification: false
  });

  expect(getSourceLane(item)).toBe("flood");
  expect(getPrimaryAction(item)).toEqual(
    expect.objectContaining({
      href: "/dashboard/scanner?queue=sdr&opportunity=opp-queued",
      label: "Review in SDR lane"
    })
  );
});

test("qualified opportunities without verified contact stay out of buyer flow", () => {
  const item = makeOpportunity({
    id: "opp-qualified",
    qualification_status: "qualified_contactable",
    research_only: false,
    requires_sdr_qualification: false,
    dispatch_ready: false,
    verification_status: "review"
  });

  expect(getPrimaryAction(item)).toEqual(
    expect.objectContaining({
      href: "/dashboard/scanner?queue=sdr&opportunity=opp-qualified",
      label: "Complete verification"
    })
  );
});

test("verified contact ready opportunities can launch buyer flow", () => {
  const item = makeOpportunity({
    id: "opp-ready",
    qualification_status: "qualified_contactable",
    research_only: false,
    requires_sdr_qualification: false,
    dispatch_ready: true,
    verification_status: "verified"
  });

  expect(getPrimaryAction(item)).toEqual(
    expect.objectContaining({
      href: "/dashboard/outbound?opportunity=opp-ready",
      label: "Launch buyer flow"
    })
  );
});

test("mold and sewage opportunities stay in a restoration-specific lane until verified", () => {
  const item = makeOpportunity({
    id: "opp-biohazard",
    source_types: ["incident"],
    confidence_reasoning: "Public incident page shows sewage backup and contamination.",
    distress_context_summary: "Mold remediation and biohazard cleanup likely after sewage overflow."
  });

  expect(getSourceLane(item)).toBe("mold_biohazard");
  expect(getPrimaryAction(item)).toEqual(
    expect.objectContaining({
      href: "/dashboard/scanner?queue=sdr&opportunity=opp-biohazard",
      label: "Send to SDR"
    })
  );
});

test("mold_biohazard opportunities remain SDR-gated until verified contact is dispatch-ready", () => {
  const needsVerification = makeOpportunity({
    id: "opp-biohazard-qualified",
    source_types: ["incident"],
    confidence_reasoning: "Biohazard incident and mold spread after sewage overflow.",
    distress_context_summary: "Mold and biohazard cleanup expected.",
    qualification_status: "qualified_contactable",
    verification_status: "review",
    dispatch_ready: false,
    research_only: false,
    requires_sdr_qualification: false
  });

  expect(getSourceLane(needsVerification)).toBe("mold_biohazard");
  expect(getPrimaryAction(needsVerification)).toEqual(
    expect.objectContaining({
      href: "/dashboard/scanner?queue=sdr&opportunity=opp-biohazard-qualified",
      label: "Complete verification"
    })
  );

  const verifiedReady = {
    ...needsVerification,
    verification_status: "verified",
    dispatch_ready: true
  };

  expect(getPrimaryAction(verifiedReady)).toEqual(
    expect.objectContaining({
      href: "/dashboard/outbound?opportunity=opp-biohazard-qualified",
      label: "Launch buyer flow"
    })
  );
});
