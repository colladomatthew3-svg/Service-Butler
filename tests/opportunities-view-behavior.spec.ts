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
